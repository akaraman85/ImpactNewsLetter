import { paragraphs, type NewsletterContent, type NewsletterSection } from "@/lib/content";
import { planStoryLayouts, storyIsWide } from "@/lib/newsletter-layout";
import { SectionGallery } from "./section-gallery";

export type ViewAsset = {
  id: string;
  kind: "image" | "video";
  name: string;
  caption: string;
  src: string;
};

function Swoosh() {
  return (
    <svg className="swoosh" viewBox="0 0 180 18" aria-hidden="true">
      <path
        d="M3 12c28-10 42 8 70-2s52-8 104 3"
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function Mosaic({ assets, span }: { assets: ViewAsset[]; span: "card" | "feature" }) {
  if (assets.length === 0) return null;
  return (
    <div className="mosaic">
      <SectionGallery key={assets.map((asset) => asset.id).join("\0")} assets={assets} span={span} />
    </div>
  );
}

function storyShape(span: "card" | "feature", assets: ViewAsset[], hasBody: boolean) {
  const videoCount = assets.filter((asset) => asset.kind === "video").length;
  const album = assets.length >= 5 || videoCount >= 2 || (span === "feature" && !hasBody && assets.length > 0);
  if (assets.length === 0) return "text";
  if (album) return "album";
  if (span === "feature") return "split";
  return "stack";
}

function Story({
  section,
  assets,
  index,
  span,
  shape,
}: {
  section: NewsletterSection;
  assets: ViewAsset[];
  index: number;
  span: "card" | "feature";
  shape: "text" | "album" | "split" | "stack";
}) {
  const body = paragraphs(section.body);
  const className = `letter-story tone-${index % 3} ${span} shape-${shape}`;
  return (
    <section className={className}>
      <div className="story-heading">
        <span className="story-index" aria-hidden="true">
          {String(index + 1).padStart(2, "0")}
        </span>
        {section.heading ? <h2>{section.heading}</h2> : null}
      </div>
      {body.length > 0 ? (
        <div className="story-copy">
          {body.map((paragraph, paragraphIndex) => (
            <p className="body" key={`${section.id}-body-${paragraphIndex}`}>
              {paragraph}
            </p>
          ))}
        </div>
      ) : null}
      <Mosaic assets={assets} span={span} />
    </section>
  );
}

export function NewsletterView({
  programName,
  dateLabel,
  content,
  assets,
}: {
  programName: string;
  dateLabel: string;
  content: NewsletterContent;
  assets: ViewAsset[];
}) {
  const byId = new Map(assets.map((asset) => [asset.id, asset]));
  const intro = paragraphs(content.intro);
  const closing = paragraphs(content.closing);
  const cover = content.coverAssetId ? byId.get(content.coverAssetId) : undefined;
  const lead = cover?.kind === "image" ? cover : undefined;
  const stories = content.sections.flatMap((section) => {
    if (section.hidden) return [];
    const shots = section.assetIds.flatMap((id) => {
      if (id === content.coverAssetId) return [];
      const asset = byId.get(id);
      return asset ? [asset] : [];
    });
    if (!section.heading && !section.body.trim() && shots.length === 0) return [];
    return [{ section, shots }];
  });
  const layouts = planStoryLayouts(
    stories.map(({ section, shots }) =>
      storyIsWide({
        id: section.id,
        imageCount: shots.filter((asset) => asset.kind === "image").length,
        videoCount: shots.filter((asset) => asset.kind === "video").length,
      }),
    ),
  );
  return (
    <div className="letter-page">
      <article className="newsletter">
        {lead ? (
          <figure className="letter-cover">
            {/* Dropbox links expire and are not served through the image optimizer. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lead.src}
              alt={lead.caption ? "" : lead.name}
              referrerPolicy="no-referrer"
              decoding="async"
              fetchPriority="high"
            />
            {lead.caption ? <figcaption>{lead.caption}</figcaption> : null}
          </figure>
        ) : null}
        <header className="letter-mast">
          <div className="letter-mast-copy">
            <div className="letter-meta">
              <p className="kicker">{programName}</p>
              {dateLabel ? <p className="date-stamp">{dateLabel}</p> : null}
            </div>
            <h1>{content.headline}</h1>
            <Swoosh />
            {content.subtitle ? <p className="lede">{content.subtitle}</p> : null}
          </div>
          {intro.length > 0 ? (
            <div className="intro-card">
              {intro.map((paragraph, index) => (
                <p className="intro" key={`intro-${index}`}>
                  {paragraph}
                </p>
              ))}
            </div>
          ) : null}
        </header>
        <div className="letter-spread">
          {stories.map(({ section, shots }, index) => {
            const layout = layouts[index] ?? "card";
            const shape = storyShape(layout, shots, paragraphs(section.body).length > 0);
            return (
              <Story
                key={section.id}
                section={section}
                assets={shots}
                index={index}
                span={layout}
                shape={shape}
              />
            );
          })}
        </div>
        {closing.length > 0 ? (
          <footer className="letter-close">
            <p className="kicker">P.S.</p>
            {closing.map((paragraph, index) => (
              <p className="closing" key={`closing-${index}`}>
                {paragraph}
              </p>
            ))}
          </footer>
        ) : null}
        <p className="private-note">
          This page is for families. The link is the key, so please keep it inside the people it was sent to.
        </p>
      </article>
    </div>
  );
}
