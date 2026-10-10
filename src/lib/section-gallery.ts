import { mediaPreviewSrc, mediaStillSrc } from "./media-picker";

export type GalleryAsset = {
  id: string;
  kind: "image" | "video";
  name: string;
  caption: string;
  src: string;
};

export type MeasuredSize = {
  width: number;
  height: number;
};

export type GalleryPhoto = {
  key: string;
  src: string;
  width: number;
  height: number;
  alt: string;
  label: string;
  id: string;
  kind: "image" | "video";
  caption: string;
};

export type GallerySlide =
  | {
      type: "image";
      src: string;
      alt: string;
      width: number;
      height: number;
      thumbnail: string;
      description?: string;
    }
  | {
      type: "video";
      poster: string;
      width: number;
      height: number;
      description?: string;
      sources: readonly { src: string; type: string }[];
    };

export type GalleryRowConstraints = {
  minPhotos?: number;
  maxPhotos?: number;
  singleRowMaxHeight?: number;
};

// Display previews are resized to this long edge. Lightbox sizing uses pixels,
// so a bare 4:3 ratio would collapse the open photo to a few pixels.
const DISPLAY_EDGE = 1800;
const RATIO_EPSILON = 0.03;

function fallbackRatio(kind: GalleryAsset["kind"]): MeasuredSize {
  return kind === "video" ? { width: 16, height: 9 } : { width: 4, height: 3 };
}

function ratiosMatch(left: MeasuredSize, right: MeasuredSize) {
  if (left.height < 2 || right.height < 2) return false;
  return Math.abs(left.width / left.height - right.width / right.height) < RATIO_EPSILON;
}

function assetTitle(asset: GalleryAsset) {
  return asset.caption.trim() || asset.name.trim() || (asset.kind === "video" ? "video" : "photo");
}

function captionText(asset: GalleryAsset) {
  const caption = asset.caption.trim();
  return caption || undefined;
}

// Phone clips are .mov. Chrome will not request a source labeled video/quicktime,
// so those files are offered as video/mp4, which Safari still plays.
export function videoSourceType(name: string) {
  const extension = name.split(".").pop()?.toLowerCase() ?? "";
  if (extension === "webm") return "video/webm";
  return "video/mp4";
}

export function galleryLabel(assets: readonly { kind: string }[]) {
  const videos = assets.filter((asset) => asset.kind === "video").length;
  if (videos === 0) return assets.length === 1 ? "Photo" : "Photos";
  if (videos === assets.length) return assets.length === 1 ? "Video" : "Videos";
  return "Photos and videos";
}

export function galleryContainerWidth(span: "card" | "feature") {
  return span === "feature" ? 1040 : 480;
}

export function galleryRowHeight(count: number, containerWidth: number) {
  const width = containerWidth > 0 ? containerWidth : 640;
  const narrow = width < 640;
  if (count <= 1) return narrow ? 260 : 440;
  if (count === 2) return narrow ? 200 : 320;
  if (count <= 4) return narrow ? 170 : 250;
  return narrow ? 148 : 200;
}

export function galleryRowConstraints(count: number, containerWidth: number): GalleryRowConstraints {
  const width = containerWidth > 0 ? containerWidth : 640;
  if (count <= 1) return { singleRowMaxHeight: 520 };
  if (count === 2) return { maxPhotos: 2, singleRowMaxHeight: width < 640 ? 260 : 380 };
  return {
    minPhotos: 1,
    maxPhotos: width < 560 ? 2 : 3,
    singleRowMaxHeight: 360,
  };
}

// Phone photos keep their real ratio. Video stills from Dropbox are a fixed
// 4:3 poster, so a clip stays 16:9 instead of inheriting that poster box.
export function adoptMeasuredSize(
  kind: GalleryAsset["kind"],
  current: MeasuredSize | undefined,
  width: number,
  height: number,
): MeasuredSize | null {
  if (kind !== "image") return null;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 2 || height < 2) return null;
  const next = { width, height };
  if (ratiosMatch(current ?? fallbackRatio("image"), next)) return null;
  return next;
}

export function galleryFrame(kind: GalleryAsset["kind"], measured?: MeasuredSize): MeasuredSize {
  const source =
    kind === "image" && measured && measured.width >= 2 && measured.height >= 2
      ? measured
      : fallbackRatio(kind);
  const long = Math.max(source.width, source.height);
  const scale = DISPLAY_EDGE / long;
  return {
    width: Math.max(1, Math.round(source.width * scale)),
    height: Math.max(1, Math.round(source.height * scale)),
  };
}

export function sectionGalleryPhotos(
  assets: readonly GalleryAsset[],
  measured: Readonly<Record<string, MeasuredSize>>,
): GalleryPhoto[] {
  return assets.map((asset) => {
    const frame = galleryFrame(asset.kind, measured[asset.id]);
    const title = assetTitle(asset);
    return {
      key: asset.id,
      id: asset.id,
      kind: asset.kind,
      caption: asset.caption.trim(),
      src: asset.kind === "video" ? mediaStillSrc(asset.src, "thumb") : mediaPreviewSrc(asset.src, "thumb"),
      width: frame.width,
      height: frame.height,
      alt: "",
      label: asset.kind === "video" ? `Play ${title}` : `Open ${title}`,
    };
  });
}

export function sectionLightboxSlides(
  assets: readonly GalleryAsset[],
  measured: Readonly<Record<string, MeasuredSize>>,
): GallerySlide[] {
  return assets.map((asset) => {
    const frame = galleryFrame(asset.kind, measured[asset.id]);
    const description = captionText(asset);
    if (asset.kind === "video") {
      return {
        type: "video",
        poster: mediaStillSrc(asset.src, "display"),
        width: frame.width,
        height: frame.height,
        description,
        sources: [{ src: asset.src, type: videoSourceType(asset.name) }],
      };
    }
    return {
      type: "image",
      src: mediaPreviewSrc(asset.src, "display"),
      thumbnail: mediaPreviewSrc(asset.src, "thumb"),
      alt: assetTitle(asset),
      width: frame.width,
      height: frame.height,
      description,
    };
  });
}
