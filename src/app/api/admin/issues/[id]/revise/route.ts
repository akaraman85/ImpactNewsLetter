import { chat, chatParamsFromRequest, toServerSentEventsResponse } from "@tanstack/ai";
import { openaiCompatibleText } from "@tanstack/ai-openai/compatible";
import { NextResponse } from "next/server";
import { newsletterModel } from "@/lib/ai";
import { requireStaff } from "@/lib/auth";
import { getIssue, getSettings } from "@/lib/data";
import { AI_GATEWAY_CHAT_BASE_URL, gatewayApiKey } from "@/lib/gateway-auth";
import { isLoginRedirect } from "@/lib/login-redirect";
import { reviseSystemPrompt } from "@/lib/letter-proposal";
import { reviseTools } from "@/lib/revise-tools";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireStaff();
  } catch (error) {
    if (isLoginRedirect(error)) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }
    throw error;
  }

  const { id } = await params;
  let chatRequest;
  try {
    chatRequest = await chatParamsFromRequest(request);
  } catch (error) {
    if (error instanceof Response) return error;
    throw error;
  }

  const [issue, settings, apiKey] = await Promise.all([getIssue(id), getSettings(), gatewayApiKey()]);
  if (!issue) return NextResponse.json({ error: "That issue is gone." }, { status: 404 });
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "Revisions need the AI Gateway. Set AI_GATEWAY_API_KEY locally. On Vercel, the project OIDC token is used.",
      },
      { status: 503 },
    );
  }

  try {
    const stream = chat({
      adapter: openaiCompatibleText(newsletterModel(), {
        name: "vercel-ai-gateway",
        baseURL: AI_GATEWAY_CHAT_BASE_URL,
        apiKey,
        api: "chat-completions",
      }),
      systemPrompts: [reviseSystemPrompt(settings.programName)],
      messages: chatRequest.messages,
      threadId: chatRequest.threadId,
      runId: chatRequest.runId,
      parentRunId: chatRequest.parentRunId,
      ...(chatRequest.resume ? { resume: chatRequest.resume } : {}),
      tools: reviseTools(id),
    });
    return toServerSentEventsResponse(stream);
  } catch (error) {
    console.error("revise letter failed", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json(
      { error: "The revision could not be started. You can still edit the letter by hand." },
      { status: 502 },
    );
  }
}
