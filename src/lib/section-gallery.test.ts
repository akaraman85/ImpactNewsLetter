import assert from "node:assert/strict";
import test from "node:test";
import {
  adoptMeasuredSize,
  galleryContainerWidth,
  galleryFrame,
  galleryLabel,
  galleryRowConstraints,
  galleryRowHeight,
  sectionGalleryPhotos,
  sectionLightboxSlides,
  videoSourceType,
} from "./section-gallery.ts";

const photo = {
  id: "photo",
  kind: "image" as const,
  name: "relay.jpg",
  caption: "At the finish",
  src: "/api/media/token/photo",
};

const clip = {
  id: "clip",
  kind: "video" as const,
  name: "IMG_1802.mov",
  caption: "",
  src: "/api/media/token/clip",
};

test("a section gallery keeps every selected asset in order", () => {
  const photos = sectionGalleryPhotos([photo, clip], {});
  assert.deepEqual(
    photos.map((item) => item.key),
    ["photo", "clip"],
  );
  assert.equal(photos[0]?.src, "/api/media/token/photo?size=thumb");
  assert.equal(photos[1]?.src, "/api/media/token/clip?size=thumb");
  assert.equal(photos[0]?.label, "Open At the finish");
  assert.equal(photos[1]?.label, "Play IMG_1802.mov");
  assert.equal(photos[0]?.width, 1800);
  assert.equal(photos[0]?.height, 1350);
  assert.equal(photos[1]?.width, 1800);
  assert.ok(Math.abs(photos[1]!.width / photos[1]!.height - 16 / 9) < 0.01);
});

test("a measured photo replaces the fallback ratio and a video poster does not", () => {
  assert.equal(adoptMeasuredSize("video", undefined, 640, 480), null);
  assert.equal(adoptMeasuredSize("image", undefined, 4000, 3000), null);
  assert.equal(adoptMeasuredSize("image", undefined, 1, 1), null);
  assert.deepEqual(adoptMeasuredSize("image", undefined, 3000, 4000), { width: 3000, height: 4000 });
  assert.equal(adoptMeasuredSize("image", { width: 3000, height: 4000 }, 3024, 4032), null);

  const frame = galleryFrame("image", { width: 1200, height: 1800 });
  assert.deepEqual(frame, { width: 1200, height: 1800 });
  const photos = sectionGalleryPhotos([photo], { photo: { width: 1200, height: 1800 } });
  assert.deepEqual(
    photos.map((item) => ({ width: item.width, height: item.height })),
    [{ width: 1200, height: 1800 }],
  );
  const clips = sectionGalleryPhotos([clip], { clip: { width: 640, height: 480 } });
  assert.equal(clips[0]?.width, 1800);
  assert.ok(Math.abs(clips[0]!.width / clips[0]!.height - 16 / 9) < 0.01);
});

test("lightbox slides use the display photo and a playable video file", () => {
  const slides = sectionLightboxSlides([photo, clip], { photo: { width: 1200, height: 1800 } });
  assert.deepEqual(slides[0], {
    type: "image",
    src: "/api/media/token/photo",
    thumbnail: "/api/media/token/photo?size=thumb",
    alt: "At the finish",
    width: 1200,
    height: 1800,
    description: "At the finish",
  });
  assert.equal(slides[1]?.type, "video");
  if (slides[1]?.type !== "video") return;
  assert.equal(slides[1].poster, "/api/media/token/clip?size=display");
  assert.deepEqual(slides[1].sources, [{ src: "/api/media/token/clip", type: "video/mp4" }]);
  assert.equal(slides[1].description, undefined);
  assert.equal(videoSourceType("game.mp4"), "video/mp4");
  assert.equal(videoSourceType("game.m4v"), "video/mp4");
  assert.equal(videoSourceType("game.webm"), "video/webm");
});

test("gallery labels and row density follow the section", () => {
  assert.equal(galleryLabel([{ kind: "image" }]), "Photo");
  assert.equal(galleryLabel([{ kind: "image" }, { kind: "image" }]), "Photos");
  assert.equal(galleryLabel([{ kind: "video" }]), "Video");
  assert.equal(galleryLabel([{ kind: "video" }, { kind: "video" }]), "Videos");
  assert.equal(galleryLabel([{ kind: "image" }, { kind: "video" }]), "Photos and videos");
  assert.ok(galleryRowHeight(1, 1000) > galleryRowHeight(11, 1000));
  assert.ok(galleryRowHeight(11, 400) < galleryRowHeight(11, 1000));
  assert.equal(galleryRowConstraints(11, 400).maxPhotos, 2);
  assert.equal(galleryRowConstraints(11, 900).maxPhotos, 3);
  assert.equal(galleryRowConstraints(2, 900).maxPhotos, 2);
  assert.equal(galleryRowConstraints(1, 900).maxPhotos, undefined);
  assert.equal(galleryContainerWidth("feature"), 1040);
  assert.equal(galleryContainerWidth("card"), 480);
});
