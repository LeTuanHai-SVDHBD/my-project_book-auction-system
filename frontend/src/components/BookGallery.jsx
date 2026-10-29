/** All media belong to one post/physical copy. The video player uses the stored real URL. */
import { useState } from "react";
import { Icon } from "./DesignUi.jsx";
export default function BookGallery({ items = [] }) {
  const [selected, setSelected] = useState(0),
    media = items[selected] || items[0];
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
      aria-label="Ảnh và video cùng bản sách"
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
          <a href={media.url} target="_blank" rel="noreferrer">
            <img src={media.url} alt={media.title || "Ảnh bản sách"} />
          </a>
        )}
      </div>
      <p className="field-hint">
        {media.title || `Media ${selected + 1}`} ·{" "}
        {items.filter((i) => i.kind === "image").length} ảnh /{" "}
        {items.filter((i) => i.kind === "video").length} video · Cùng một bản
        sách
      </p>
      <div className="gallery-thumbnails">
        {items.map((item, i) => (
          <button
            key={item.url + "-" + i}
            type="button"
            aria-label={`${item.kind === "video" ? "Video" : "Ảnh"} ${i + 1}: ${item.title || "bản sách"}`}
            aria-pressed={selected === i}
            onClick={() => setSelected(i)}
          >
            {item.kind === "image" ? (
              <img src={item.url} alt="" />
            ) : (
              <>
                <Icon name="play" size={30} />
                <span>Video</span>
              </>
            )}
          </button>
        ))}
      </div>
    </section>
  );
}
