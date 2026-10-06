import { paragraphs, type NewsletterContent } from "@/lib/content";

export type ViewAsset = {
  id: string;
  kind: "image" | "video";
  name: string;
  caption: string;
  src: string;
};

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
  return (
    <article className="newsletter">
      <p className="kicker">{programName}</p>
      <h1>{content.headline}</h1>
      {content.subtitle ? <p className="lede">{content.subtitle}</p> : null}
      {dateLabel ? <p className="muted">{dateLabel}</p> : null}
      {paragraphs(content.intro).map((paragraph, index) => (
        <p className="intro" key={`intro-${index}`}>
          {paragraph}
        </p>
      ))}
      {content.sections.map((section) => {
        const shots = section.assetIds.flatMap((id) => {
          const asset = byId.get(id);
          return asset ? [asset] : [];
        });
        return (
          <section key={section.id}>
            {section.heading ? <h2>{section.heading}</h2> : null}
            {paragraphs(section.body).map((paragraph, index) => (
              <p className="body" key={`${section.id}-body-${index}`}>
                {paragraph}
              </p>
            ))}
            {shots.length > 0 ? (
              <div className="gallery">
                {shots.map((asset) => (
                  <figure key={asset.id}>
                    {asset.kind === "video" ? (
                      <video controls playsInline preload="metadata" src={asset.src} />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={asset.src} alt={asset.caption || asset.name} referrerPolicy="no-referrer" />
                    )}
                    {asset.caption ? <figcaption>{asset.caption}</figcaption> : null}
                  </figure>
                ))}
              </div>
            ) : null}
          </section>
        );
      })}
      {paragraphs(content.closing).map((paragraph, index) => (
        <p className="closing" key={`closing-${index}`}>
          {paragraph}
        </p>
      ))}
      <p className="private-note">
        This page is for families. The link is the key, so please keep it inside the people it was sent to.
      </p>
    </article>
  );
}
