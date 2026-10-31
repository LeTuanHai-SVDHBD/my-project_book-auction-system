/** Kính lúp ảnh ở desktop; chạm/Enter vẫn mở đúng ảnh gốc để xem trên mọi thiết bị. */
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./DesignUi.jsx";
import { containedImage, imageZoomView } from "../utils/imageZoom.js";
export default function ImageZoom({ src, alt }) {
  const target = useRef(null),
    image = useRef(null),
    position = useRef({ x: 0.5, y: 0.5 });
  const [view, setView] = useState(null),
    [failed, setFailed] = useState(false),
    hint = useId();
  useEffect(() => {
    const hide = () => setView(null);
    window.addEventListener("resize", hide);
    window.addEventListener("scroll", hide, true);
    return () => {
      window.removeEventListener("resize", hide);
      window.removeEventListener("scroll", hide, true);
    };
  }, []);
  function show(point) {
    const img = image.current;
    if (failed || !img?.complete) return setView(null);
    const bounds = containedImage(
      img.getBoundingClientRect(),
      img.naturalWidth,
      img.naturalHeight,
    );
    if (!bounds) return setView(null);
    const cursor = point || {
      x:
        bounds.left +
        bounds.width * Math.max(0, Math.min(1, position.current.x)),
      y:
        bounds.top +
        bounds.height * Math.max(0, Math.min(1, position.current.y)),
    };
    position.current = {
      x: Math.max(0, Math.min(1, (cursor.x - bounds.left) / bounds.width)),
      y: Math.max(0, Math.min(1, (cursor.y - bounds.top) / bounds.height)),
    };
    setView(
      imageZoomView({
        image: bounds,
        frame: target.current.getBoundingClientRect(),
        point: cursor,
        viewport: {
          width: document.documentElement.clientWidth,
          height: window.innerHeight,
        },
      }),
    );
  }
  function move(event) {
    if (
      event.pointerType !== "mouse" ||
      !window.matchMedia("(hover: hover) and (pointer: fine)").matches
    )
      return;
    show({ x: event.clientX, y: event.clientY });
  }
  function keyDown(event) {
    if (event.key === "Escape") {
      setView(null);
      event.preventDefault();
      return;
    }
    const direction = {
      ArrowLeft: [-0.06, 0],
      ArrowRight: [0.06, 0],
      ArrowUp: [0, -0.06],
      ArrowDown: [0, 0.06],
    }[event.key];
    if (!direction || !view) return;
    event.preventDefault();
    position.current = {
      x: position.current.x + direction[0],
      y: position.current.y + direction[1],
    };
    show();
  }
  return (
    <div className="image-zoom">
      <a
        ref={target}
        className="image-zoom-target"
        href={src}
        target="_blank"
        rel="noreferrer"
        aria-label={`Phóng to ảnh: ${alt} (mở ảnh gốc)`}
        aria-describedby={hint}
        onPointerMove={move}
        onPointerLeave={() => setView(null)}
        onPointerCancel={() => setView(null)}
        onFocus={() => {
          position.current = { x: 0.5, y: 0.5 };
          show();
        }}
        onBlur={() => setView(null)}
        onKeyDown={keyDown}
        onClick={() => setView(null)}
      >
        {failed ? (
          <div className="image-zoom-unavailable">
            <Icon name="image" size={48} />
            <span>Không tải được bản xem trước. Bạn có thể mở ảnh gốc.</span>
          </div>
        ) : (
          <img
            ref={image}
            src={src}
            alt={alt}
            draggable="false"
            onError={() => {
              setFailed(true);
              setView(null);
            }}
          />
        )}
        <span className="image-zoom-action">
          <Icon name="search" size={18} /> Phóng to ảnh
        </span>
      </a>
      <p id={hint} className="image-zoom-hint">
        <span className="image-zoom-desktop-hint">
          Rê chuột lên ảnh để soi chi tiết; dùng phím mũi tên khi chọn ảnh bằng
          Tab.{" "}
        </span>
        Nhấn ảnh để mở ảnh gốc và phóng to.
      </p>
      {view &&
        createPortal(
          <div className="image-zoom-overlay" aria-hidden="true">
            <div className="image-zoom-lens" style={view.lens} />
            <div className="image-zoom-detail" style={view.panel}>
              <img src={src} alt="" draggable="false" style={view.detail} />
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
