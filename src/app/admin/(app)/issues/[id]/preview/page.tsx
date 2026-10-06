import { NewsletterView } from "@/components/newsletter";
import { placeUnusedAssets } from "@/lib/content";
import { getIssue, getSettings, issueContent, listAssets } from "@/lib/data";
import { formatEventDate } from "@/lib/format";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function PreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const issue = await getIssue(id);
  if (!issue) notFound();
  const [settings, media] = await Promise.all([getSettings(), listAssets(id)]);
  const content = placeUnusedAssets(
    issueContent(issue),
    media.filter((asset) => asset.included).map((asset) => asset.id),
  );
  return (
    <NewsletterView
      programName={settings.programName}
      dateLabel={formatEventDate(issue.eventDate)}
      content={content}
      assets={media
        .filter((asset) => asset.included)
        .map((asset) => ({
          id: asset.id,
          kind: asset.kind === "video" ? "video" : "image",
          name: asset.name,
          caption: asset.caption,
          src: `/api/admin/media/${asset.id}`,
        }))}
    />
  );
}
