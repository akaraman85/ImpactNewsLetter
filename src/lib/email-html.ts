import { paragraphs } from "./content";
import type { NewsletterContent } from "./content";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function renderEmailHtml(input: {
  programName: string;
  content: NewsletterContent;
  eventDate: string;
  viewUrl: string | null;
}) {
  const intro = paragraphs(input.content.intro)
    .map((paragraph) => `<p style="margin:0 0 14px;line-height:1.55;">${escapeHtml(paragraph)}</p>`)
    .join("");
  const button = input.viewUrl
    ? `<p style="margin:24px 0;"><a href="${escapeHtml(input.viewUrl)}" style="background:#1b6240;color:#fffdf8;text-decoration:none;padding:12px 18px;border-radius:999px;display:inline-block;">Open the photos</a></p>`
    : `<p style="margin:24px 0;">Publish the issue to include the private family link.</p>`;

  return `<!doctype html>
<html>
  <body style="margin:0;background:#f4efe6;color:#1c1915;font-family:Georgia,serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center" style="padding:28px 16px;">
          <table role="presentation" width="100%" style="max-width:560px;background:#fffdf8;border-radius:18px;padding:28px;">
            <tr>
              <td>
                <p style="letter-spacing:0.08em;text-transform:uppercase;font-size:12px;font-family:Arial,sans-serif;color:#5e584e;margin:0 0 8px;">${escapeHtml(input.programName)}</p>
                <h1 style="font-size:32px;line-height:1.15;margin:0 0 8px;">${escapeHtml(input.content.headline)}</h1>
                <p style="margin:0 0 18px;color:#5e584e;font-family:Arial,sans-serif;">${escapeHtml(input.eventDate)}</p>
                ${intro}
                ${button}
                <p style="margin:0;color:#5e584e;font-family:Arial,sans-serif;font-size:13px;">This note is for families. The photo page stays private to the link.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
