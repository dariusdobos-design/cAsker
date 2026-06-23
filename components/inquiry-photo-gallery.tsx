"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

type InquiryPhotoGalleryProps = {
  photos: string[];
};

export function InquiryPhotoGallery({ photos }: InquiryPhotoGalleryProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const closeLightbox = useCallback(() => {
    setActiveIndex(null);
  }, []);

  const showPrevious = useCallback(() => {
    setActiveIndex((current) => {
      if (current === null || photos.length === 0) return current;
      return (current - 1 + photos.length) % photos.length;
    });
  }, [photos.length]);

  const showNext = useCallback(() => {
    setActiveIndex((current) => {
      if (current === null || photos.length === 0) return current;
      return (current + 1) % photos.length;
    });
  }, [photos.length]);

  useEffect(() => {
    if (activeIndex === null) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeLightbox();
      } else if (event.key === "ArrowLeft") {
        showPrevious();
      } else if (event.key === "ArrowRight") {
        showNext();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeIndex, closeLightbox, showNext, showPrevious]);

  if (photos.length === 0) {
    return null;
  }

  const activePhoto = activeIndex === null ? null : photos[activeIndex];

  const lightbox =
    activePhoto && typeof document !== "undefined"
      ? createPortal(
          <div
            className="casker-inquiry-photo-lightbox"
            role="dialog"
            aria-modal="true"
            aria-label="Náhľad fotky dopytu"
            onClick={closeLightbox}
          >
            <button
              type="button"
              className="casker-inquiry-photo-lightbox-close"
              onClick={closeLightbox}
              aria-label="Zavrieť"
            >
              <X className="h-5 w-5" strokeWidth={2.25} />
            </button>

            {photos.length > 1 ? (
              <>
                <button
                  type="button"
                  className="casker-inquiry-photo-lightbox-nav is-prev"
                  onClick={(event) => {
                    event.stopPropagation();
                    showPrevious();
                  }}
                  aria-label="Predchádzajúca fotka"
                >
                  ‹
                </button>
                <button
                  type="button"
                  className="casker-inquiry-photo-lightbox-nav is-next"
                  onClick={(event) => {
                    event.stopPropagation();
                    showNext();
                  }}
                  aria-label="Ďalšia fotka"
                >
                  ›
                </button>
              </>
            ) : null}

            <img
              src={activePhoto}
              alt={`Fotka dopytu ${activeIndex! + 1}`}
              className="casker-inquiry-photo-lightbox-image"
              onClick={(event) => event.stopPropagation()}
            />
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <ul className="casker-inquiry-photo-grid" aria-label="Fotky k dopytu">
        {photos.map((photo, index) => (
          <li key={`${index}-${photo.slice(-24)}`} className="casker-inquiry-photo-item">
            <button
              type="button"
              className="casker-inquiry-photo-thumb"
              onClick={() => setActiveIndex(index)}
              aria-label={`Zväčšiť fotku ${index + 1}`}
            >
              <img src={photo} alt={`Fotka dopytu ${index + 1}`} />
            </button>
          </li>
        ))}
      </ul>

      {lightbox}
    </>
  );
}
