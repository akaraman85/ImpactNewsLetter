"use client";

import Lightbox from "yet-another-react-lightbox";
import Captions from "yet-another-react-lightbox/plugins/captions";
import Counter from "yet-another-react-lightbox/plugins/counter";
import Fullscreen from "yet-another-react-lightbox/plugins/fullscreen";
import Slideshow from "yet-another-react-lightbox/plugins/slideshow";
import Thumbnails from "yet-another-react-lightbox/plugins/thumbnails";
import Video from "yet-another-react-lightbox/plugins/video";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import "yet-another-react-lightbox/styles.css";
import "yet-another-react-lightbox/plugins/captions.css";
import "yet-another-react-lightbox/plugins/counter.css";
import "yet-another-react-lightbox/plugins/thumbnails.css";
import type { GallerySlide } from "@/lib/section-gallery";

const plugins = [Captions, Counter, Fullscreen, Slideshow, Thumbnails, Zoom, Video];

export function SectionLightbox({
  index,
  slides,
  reduceMotion,
  onClose,
}: {
  index: number;
  slides: GallerySlide[];
  reduceMotion: boolean;
  onClose: () => void;
}) {
  return (
    <Lightbox
      open
      close={onClose}
      index={index}
      slides={slides}
      plugins={plugins}
      carousel={{ preload: 1, imageProps: { referrerPolicy: "no-referrer" } }}
      animation={reduceMotion ? { fade: 0, swipe: 0, navigation: 0 } : undefined}
      controller={{ closeOnBackdropClick: true }}
      captions={{ descriptionTextAlign: "center", descriptionMaxLines: 4 }}
      slideshow={{ delay: 4500 }}
      thumbnails={{
        imageFit: "cover",
        width: 96,
        height: 68,
        border: 2,
        borderRadius: 10,
        padding: 2,
        gap: 10,
      }}
      video={{ autoPlay: true, controls: true, playsInline: true, preload: "metadata" }}
      labels={{
        Lightbox: "Section gallery",
        Previous: "Previous photo",
        Next: "Next photo",
        Close: "Close gallery",
        Play: "Play slideshow",
        Pause: "Pause slideshow",
        "Enter Fullscreen": "Full screen",
        "Exit Fullscreen": "Leave full screen",
      }}
      className="letter-lightbox"
      styles={{
        root: {
          "--yarl__color_backdrop": "rgba(28, 25, 21, 0.94)",
        },
      }}
    />
  );
}
