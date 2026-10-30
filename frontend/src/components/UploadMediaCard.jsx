/** Remove only a newly uploaded ticket; persisted historical media has no remove action. */
import { Icon } from "./DesignUi.jsx";
export default function UploadMediaCard({ item, onRemove, disabled = false }) {
  const label =
    item.tieu_de ||
    item.title ||
    (item.kind === "video" ? "Video bản sách" : "Ảnh bản sách");
  return (
    <figure className="upload-media-card">
      <div className="upload-media-preview">
        {item.kind === "video" ? (
          <video
            src={item.url}
            controls
            preload="metadata"
            aria-label={label}
          />
        ) : (
          <img src={item.url} alt={label} />
        )}
      </div>
      <figcaption>
        <span>{item.kind === "video" ? "VIDEO" : "ẢNH"}</span>
        <b title={label}>{label}</b>
      </figcaption>
      <button
        type="button"
        className="remove-upload"
        aria-label={`Bỏ ${item.kind === "video" ? "video" : "ảnh"} ${label}`}
        title="Bỏ tệp vừa tải lên"
        disabled={disabled}
        onClick={() => onRemove(item)}
      >
        <Icon name="close" size={18} />
      </button>
    </figure>
  );
}
