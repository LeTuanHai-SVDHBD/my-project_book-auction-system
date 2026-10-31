/** All media belong to one post/physical copy. The video player uses the stored real URL. */
import { useEffect, useRef, useState } from "react";
import ImageZoom from "./ImageZoom.jsx";
import { Icon } from "./DesignUi.jsx";
export default function BookGallery({ items = [] }) {
  const thumbnails = useRef(null),
    gallery = useRef(null),
    selectionAction = useRef(null);
  const [selected, setSelected] = useState(0);
  const current = Math.min(selected, Math.max(0, items.length - 1)),
    media = items[current];
  useEffect(() => {
    const action = selectionAction.current;
    if (!action) return;
    selectionAction.current = null;
    const strip = thumbnails.current,
      active = strip?.querySelectorAll("button")[current];
    if (active) {
      const bounds = strip.getBoundingClientRect(),
        item = active.getBoundingClientRect();
      const offset =
        item.left < bounds.left
          ? item.left - bounds.left
          : item.right > bounds.right
            ? item.right - bounds.right
            : 0;
      if (offset)
        strip.scrollBy({
          left: offset,
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
            .matches
            ? "auto"
            : "smooth",
        });
      if (action === "thumbnail") active.focus({ preventScroll: true });
    }
    if (action === "stage")
      gallery.current
        ?.querySelector(".image-zoom-target, video")
        ?.focus({ preventScroll: true });
  }, [current]);
  function choose(index, focus = "keep") {
    const next = Math.max(0, Math.min(items.length - 1, index));
    if (next === current) return;
    selectionAction.current = focus;
    setSelected(next);
  }
  function keyboard(event) {
    if (
      event.defaultPrevented ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.target.closest("video")
    )
      return;
    const withinStrip = event.target.closest(".gallery-browser");
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? items.length - 1
          : withinStrip && event.key === "ArrowLeft"
            ? current - 1
            : withinStrip && event.key === "ArrowRight"
              ? current + 1
              : null;
    if (next === null) return;
    event.preventDefault();
    choose(next, withinStrip ? "thumbnail" : "stage");
  }
  if (!media)
    return (
      <div className="gallery-empty">
        <Icon name="image" size={64} />
        <p>Chưa có ảnh hoặc video cho bản sách này.</p>
      </div>
    );
  return (
    <section
      className="live-book-gallery"
      ref={gallery}
      onKeyDown={keyboard}
      aria-label="Ảnh và video cùng bản sách"
      aria-keyshortcuts="Home End"
    >
      <div className="gallery-stage">
        {media.kind === "video" ? (
          <video
            key={media.url}
            src={media.url}
            controls
            preload="metadata"
            aria-label={media.title || "Video bản sách"}
          />
        ) : (
          <ImageZoom
            key={media.url}
            src={media.url}
            alt={media.title || "Ảnh bản sách"}
          />
        )}
      </div>
      <p className="field-hint" aria-live="polite" aria-atomic="true">
        {current + 1}/{items.length} · {media.title || `Media ${current + 1}`} ·{" "}
        {items.filter((i) => i.kind === "image").length} ảnh /{" "}
        {items.filter((i) => i.kind === "video").length} video · Cùng một bản
        sách
      </p>
      <div className="gallery-browser">
        <button
          className="gallery-scroll gallery-scroll-back"
          type="button"
          aria-label="Ảnh hoặc video trước"
          title="Ảnh/video trước (←)"
          disabled={current === 0}
          onClick={() => choose(current - 1)}
        >
          <Icon name="arrow" size={20} />
        </button>
        <div
          className="gallery-thumbnails"
          ref={thumbnails}
          role="group"
          aria-label="Chọn ảnh hoặc video"
        >
          {items.map((item, i) => (
            <button
              key={item.url + "-" + i}
              type="button"
              aria-label={`${item.kind === "video" ? "Video" : "Ảnh"} ${i + 1}: ${item.title || "bản sách"}`}
              aria-pressed={current === i}
              tabIndex={current === i ? 0 : -1}
              onClick={() => choose(i)}
            >
              {item.kind === "image" ? (
                <img src={item.url} alt="" loading="lazy" />
              ) : (
                <>
                  <Icon name="play" size={30} />
                  <span>Video</span>
                </>
              )}
            </button>
          ))}
        </div>
        <button
          className="gallery-scroll"
          type="button"
          aria-label="Ảnh hoặc video tiếp theo"
          title="Ảnh/video tiếp theo (→)"
          disabled={current === items.length - 1}
          onClick={() => choose(current + 1)}
        >
          <Icon name="arrow" size={20} />
        </button>
      </div>
    </section>
  );
}
