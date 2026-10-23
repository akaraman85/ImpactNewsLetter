"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useFormStatus } from "react-dom";
import { fetchServerSentEvents, useChat } from "@tanstack/ai-react";
import { saveLetter } from "@/lib/actions";
import type { NewsletterContent } from "@/lib/content";
import {
  PROPOSE_EDIT_TOOL,
  READ_ASSETS_TOOL,
  READ_ISSUE_TOOL,
  letterFields,
  letterProposalSchema,
  sanitizeLetterProposal,
  type ProposalAsset,
  type SanitizedProposal,
} from "@/lib/letter-proposal";
import { proposeLetterEditDef } from "@/lib/revise-definitions";

const tools = [proposeLetterEditDef];

type ReviseAsset = ProposalAsset & { name: string };

function activityLabel(name: string) {
  if (name === READ_ISSUE_TOOL) return "Reading the saved issue…";
  if (name === READ_ASSETS_TOOL) return "Reading photos and videos…";
  if (name === PROPOSE_EDIT_TOOL) return "Writing a proposal…";
  return "Working…";
}

function ProposalActions({
  canResolve,
  resuming,
  onSkip,
}: {
  canResolve: boolean;
  resuming: boolean;
  onSkip: () => void;
}) {
  const { pending } = useFormStatus();
  const waiting = pending || !canResolve || resuming;
  return (
    <div className="row">
      <button className="btn" type="submit" disabled={waiting}>
        {pending ? "Applying…" : "Apply"}
      </button>
      <button className="btn secondary" type="button" disabled={waiting} onClick={onSkip}>
        Skip
      </button>
    </div>
  );
}

function changedMark(next: string, previous: string) {
  return next.trim() !== previous.trim() ? " · changed" : "";
}

function ProposalCard({
  issueId,
  proposal,
  current,
  assets,
  canResolve,
  resuming,
  onSkip,
}: {
  issueId: string;
  proposal: SanitizedProposal;
  current: NewsletterContent;
  assets: ReviseAsset[];
  canResolve: boolean;
  resuming: boolean;
  onSkip: () => void;
}) {
  const names = new Map(assets.map((asset) => [asset.id, asset.name]));
  const label = (id: string) => names.get(id) || id;
  return (
    <form className="revise-proposal" action={saveLetter}>
      {letterFields(issueId, proposal).map((field, index) => (
        <input key={`${field.name}-${index}`} type="hidden" name={field.name} value={field.value} />
      ))}
      <h3>Proposed edit</h3>
      <p>{proposal.summary || "A revision of the saved letter."}</p>
      <p className="muted">
        <span className="quiet-label">Headline{changedMark(proposal.headline, current.headline)}</span>
        <br />
        {proposal.headline.trim() || "The issue title will be used."}
      </p>
      <p className="muted revise-excerpt">
        <span className="quiet-label">Opening{changedMark(proposal.intro, current.intro)}</span>
        <br />
        {proposal.intro.trim() || "The opening will be empty."}
      </p>
      {proposal.coverAssetId ? <p className="muted">Main image: {label(proposal.coverAssetId)}</p> : null}
      {proposal.sections.length === 0 ? (
        <p className="muted">No sections.</p>
      ) : (
        <ul className="revise-sections">
          {proposal.sections.map((section, index) => (
            <li key={section.id}>
              <strong>{section.heading.trim() || `Section ${index + 1}`}</strong>
              {section.hidden ? " · hidden from families" : ""}
              {section.assetIds.length > 0 ? ` · ${section.assetIds.map(label).join(", ")}` : ""}
            </li>
          ))}
        </ul>
      )}
      {proposal.closing.trim() ? <p className="muted revise-excerpt">{proposal.closing}</p> : null}
      <p className="muted">Apply saves the letter. It does not publish.</p>
      <ProposalActions canResolve={canResolve} resuming={resuming} onSkip={onSkip} />
    </form>
  );
}

export function ReviseLetterPanel({
  issueId,
  content,
  assets,
}: {
  issueId: string;
  content: NewsletterContent;
  assets: ReviseAsset[];
}) {
  const [input, setInput] = useState("");
  const logRef = useRef<HTMLDivElement>(null);
  const connection = useMemo(
    () => fetchServerSentEvents(`/api/admin/issues/${encodeURIComponent(issueId)}/revise`),
    [issueId],
  );
  const { messages, sendMessage, isLoading, error, interrupts, resuming } = useChat({
    connection,
    threadId: `revise-${issueId}`,
    tools,
  });
  const pendingApproval = interrupts.length > 0;
  const busy = isLoading || resuming;

  useEffect(() => {
    const log = logRef.current;
    if (!log) return;
    log.scrollTop = log.scrollHeight;
  }, [messages, interrupts, busy]);

  const latestActivity = (() => {
    const last = messages[messages.length - 1];
    if (!last || last.role !== "assistant") return null;
    for (let index = last.parts.length - 1; index >= 0; index -= 1) {
      const part = last.parts[index];
      if (part?.type !== "tool-call") continue;
      if (part.state === "complete" || part.state === "error") continue;
      return activityLabel(part.name);
    }
    return null;
  })();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = input.trim();
    if (!text || busy || pendingApproval) return;
    setInput("");
    void sendMessage(text.slice(0, 4000));
  }

  return (
    <aside className="panel stack revise-panel" aria-label="Revise this letter">
      <div>
        <p className="kicker">Assistant</p>
        <h2>Revise this letter</h2>
      </div>
      <p className="muted">
        Ask for a change, such as a shorter opening or moving photos into a section. This reads the
        saved notes, letter, and files. Nothing is written until you choose Apply. Apply uses the
        same save as the letter form and does not publish.
      </p>
      <div className="revise-log" ref={logRef} aria-live="polite">
        {messages.length === 0 ? (
          <p className="muted">The chat stays on this page until you leave. It is not saved.</p>
        ) : (
          messages.map((message) => {
            const text = message.parts
              .filter((part) => part.type === "text" && part.content.trim())
              .map((part) => (part.type === "text" ? part.content : ""))
              .join("\n");
            if (!text || (message.role !== "user" && message.role !== "assistant")) return null;
            return (
              <p key={message.id} className={`revise-bubble ${message.role}`}>
                <span className="quiet-label">{message.role === "user" ? "You" : "Assistant"}</span>
                <br />
                {text}
              </p>
            );
          })
        )}
        {interrupts.map((interrupt) => {
          if (interrupt.kind === "unbound") {
            return (
              <p key={interrupt.id} className="muted">
                This reply is waiting.
              </p>
            );
          }
          if (interrupt.kind !== "tool-approval" || interrupt.toolName !== PROPOSE_EDIT_TOOL) {
            return (
              <div key={interrupt.id} className="revise-proposal">
                <p>This reply is waiting.</p>
                <button className="btn secondary" type="button" onClick={() => interrupt.cancel()}>
                  Skip
                </button>
              </div>
            );
          }
          const parsed = letterProposalSchema.safeParse(interrupt.originalArgs);
          if (!parsed.success) {
            if (!interrupt.canResolve) {
              return (
                <p key={interrupt.id} className="muted">
                  Writing a proposal…
                </p>
              );
            }
            return (
              <div key={interrupt.id} className="revise-proposal">
                <p>This proposal could not be read. Ask again.</p>
                <button
                  className="btn secondary"
                  type="button"
                  disabled={!interrupt.canResolve || resuming}
                  onClick={() => interrupt.resolveInterrupt(false)}
                >
                  Skip
                </button>
              </div>
            );
          }
          const proposal = sanitizeLetterProposal(parsed.data, assets);
          return (
            <ProposalCard
              key={interrupt.id}
              issueId={issueId}
              proposal={proposal}
              current={content}
              assets={assets}
              canResolve={interrupt.canResolve}
              resuming={resuming}
              onSkip={() => interrupt.resolveInterrupt(false)}
            />
          );
        })}
        {busy && latestActivity ? <p className="muted">{latestActivity}</p> : null}
        {busy && !latestActivity ? <p className="muted">Writing…</p> : null}
      </div>
      {error ? (
        <p className="alert" role="alert">
          {error.message || "The revision could not be completed."}
        </p>
      ) : null}
      <form className="stack" onSubmit={onSubmit}>
        <label className="field">
          <span>Request</span>
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Make the opening shorter"
            rows={3}
            disabled={busy || pendingApproval}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
          />
        </label>
        <div className="row">
          <button className="btn" type="submit" disabled={busy || pendingApproval || input.trim().length === 0}>
            {busy ? "Sending…" : "Send"}
          </button>
          {busy ? (
            <span className="muted">Save any letter edits first. This reads the saved issue.</span>
          ) : (
            <span className="muted">Save the letter first if you have edits that are not saved yet.</span>
          )}
        </div>
      </form>
    </aside>
  );
}
