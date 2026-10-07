import { paragraphs, type NewsletterContent, type NewsletterSection } from "@/lib/content";
import { planStoryLayouts, storyIsWide } from "@/lib/newsletter-layout";

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

function MediaFrame({ asset }: { asset: ViewAsset }) {
  const label = asset.caption || asset.name;
  return (
    <figure className={asset.kind === "video" ? "frame is-video" : "frame"}>
      <div className="frame-media">
        {asset.kind === "video" ? (
          <video controls playsInline preload="metadata" src={asset.src} aria-label={label} />
        ) : (
          // Dropbox links expire and are not served through the image optimizer.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={asset.src}
            alt={asset.caption ? "" : asset.name}
            referrerPolicy="no-referrer"
            loading="lazy"
            decoding="async"
          />
        )}
      </div>
      {asset.caption ? <figcaption>{asset.caption}</figcaption> : null}
    </figure>
  );
}

function Mosaic({ assets }: { assets: ViewAsset[] }) {
  if (assets.length === 0) return null;
  return (
    <div className="mosaic">
      {assets.map((asset) => (
        <MediaFrame key={asset.id} asset={asset} />
      ))}
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
  const clips =
    assets.length > 0 && assets.every((asset) => asset.kind === "video");
  const className = `letter-story tone-${index % 3} ${span} shape-${shape}${clips ? " clips" : ""}`;
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
      <Mosaic assets={assets} />
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
  const stories = content.sections.flatMap((section) => {
    const shots = section.assetIds.flatMap((id) => {
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
