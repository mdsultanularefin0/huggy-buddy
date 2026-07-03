import { useEffect, useState, useCallback } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

export function ImageGallery({ images, alt = "Photo" }: { images: string[]; alt?: string }) {
  const [index, setIndex] = useState<number | null>(null);
  if (!images || images.length === 0) return null;
  return (
    <>
      <div className="flex flex-wrap gap-2 mt-3">
        {images.map((url, i) => (
          <button
            key={url}
            type="button"
            onClick={() => setIndex(i)}
            className="block w-20 h-20 rounded-lg overflow-hidden border hover:ring-2 hover:ring-primary transition"
          >
            <img src={url} alt={alt} loading="lazy" className="w-full h-full object-cover" />
          </button>
        ))}
      </div>
      {index !== null && (
        <Lightbox images={images} index={index} onClose={() => setIndex(null)} onIndex={setIndex} alt={alt} />
      )}
    </>
  );
}

export function Lightbox({
  images,
  index,
  onClose,
  onIndex,
  alt = "Photo",
}: {
  images: string[];
  index: number;
  onClose: () => void;
  onIndex: (i: number) => void;
  alt?: string;
}) {
  const prev = useCallback(() => onIndex((index - 1 + images.length) % images.length), [index, images.length, onIndex]);
  const next = useCallback(() => onIndex((index + 1) % images.length), [index, images.length, onIndex]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose, prev, next]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 text-white/80 hover:text-white p-2"
        aria-label="Close"
      >
        <X className="w-6 h-6" />
      </button>
      {images.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); prev(); }}
            className="absolute left-4 text-white/80 hover:text-white p-2"
            aria-label="Previous"
          >
            <ChevronLeft className="w-8 h-8" />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); next(); }}
            className="absolute right-4 text-white/80 hover:text-white p-2"
            aria-label="Next"
          >
            <ChevronRight className="w-8 h-8" />
          </button>
        </>
      )}
      <img
        src={images[index]}
        alt={alt}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] max-w-[90vw] object-contain rounded"
      />
      {images.length > 1 && (
        <span className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/80 text-xs bg-black/40 rounded-full px-3 py-1">
          {index + 1} / {images.length}
        </span>
      )}
    </div>
  );
}
