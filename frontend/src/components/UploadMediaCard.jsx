/** Media preview; the caller decides whether removal discards an upload or stages a resubmission edit. */
import { mediaDisplayUrl } from "../../../shared/mediaDelivery.js";
import { Icon } from "./DesignUi.jsx";
export default function UploadMediaCard({
  item,
  onRemove,
  onChooseCover,
  isCover = false,
  disabled = false,
  removeTitle = "Bỏ tệp vừa tải lên",
}) {
  const label =
    item.tieu_de ||
    item.title ||
    (item.kind === "video" ? "Video bản sách" : "Ảnh bản sách");
  return (
    <figure className={`upload-media-card${isCover ? " is-cover" : ""}`}>
      <div className="upload-media-preview">
        {item.kind === "video" ? (
          <video
            src={mediaDisplayUrl(item.url, item.kind)}
            controls
            preload="metadata"
            aria-label={label}
          />
        ) : (
          <img src={mediaDisplayUrl(item.url, item.kind)} alt={label} />
        )}
      </div>
      <figcaption>
        <span>{item.kind === "video" ? "VIDEO" : "ẢNH"}</span>
        <b title={label}>{label}</b>
        {onChooseCover && item.kind === "image" && (
          <button
            type="button"
            className="cover-choice"
            aria-label={`Chọn ${label} làm ảnh chính`}
            aria-pressed={isCover}
            disabled={disabled}
            onClick={() => onChooseCover(item)}
          >
            {isCover ? "Ảnh chính" : "Đặt làm ảnh chính"}
          </button>
        )}
      </figcaption>
      {onRemove && <button
        type="button"
        className="remove-upload"
        aria-label={`Bỏ ${item.kind === "video" ? "video" : "ảnh"} ${label}`}
        title={removeTitle}
        disabled={disabled}
        onClick={() => onRemove(item)}
      >
        <Icon name="close" size={18} />
      </button>}
    </figure>
  );
}
