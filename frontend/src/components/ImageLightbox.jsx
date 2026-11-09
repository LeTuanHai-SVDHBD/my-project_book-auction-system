/** Xem ảnh lớn ngay trong trang; điều hướng giữa các ảnh của cùng bản sách. */
import { useEffect, useRef, useState } from "react";
import { Icon } from "./DesignUi.jsx";

export default function ImageLightbox({ src, alt, index, count, onSelect, onClose }) {
  const dialog = useRef(null);
  const [failedSrc, setFailedSrc] = useState(null);
  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    return () => element.close();
  }, []);

  function step(direction) {
    onSelect((index + direction + count) % count);
  }
  function keyboard(event) {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    switch (event.key) {
      case "ArrowLeft": step(-1); break;
      case "ArrowRight": step(1); break;
      case "Home": onSelect(0); break;
      case "End": onSelect(count - 1); break;
      default: return;
    }
    event.preventDefault();
    event.stopPropagation();
  }
  function dismissBackground(event) {
    if (event.target === event.currentTarget) onClose();
  }
  return (
    <dialog
      ref={dialog}
      className="image-lightbox"
      aria-label="Xem ảnh bản sách"
      aria-keyshortcuts="ArrowLeft ArrowRight Home End Escape"
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClick={dismissBackground}
      onKeyDown={keyboard}
    >
      <button type="button" className="lightbox-close" aria-label="Đóng ảnh phóng to" autoFocus onClick={onClose}>
        <Icon name="close" size={24} />
      </button>
      <div className="lightbox-stage" onClick={dismissBackground}>
        {failedSrc === src ? (
          <p role="status">Không tải được ảnh này.</p>
        ) : (
          <img key={src} src={src} alt={alt} onError={() => setFailedSrc(src)} />
        )}
      </div>
      <div className="lightbox-controls">
        {count > 1 && (
          <button type="button" aria-label="Ảnh trước" onClick={() => step(-1)}>
            <Icon name="arrow" size={22} />
          </button>
        )}
        <span aria-live="polite" aria-atomic="true">Ảnh {index + 1} / {count}</span>
        {count > 1 && (
          <button type="button" aria-label="Ảnh tiếp theo" onClick={() => step(1)}>
            <Icon name="arrow" size={22} />
          </button>
        )}
      </div>
    </dialog>
  );
}
