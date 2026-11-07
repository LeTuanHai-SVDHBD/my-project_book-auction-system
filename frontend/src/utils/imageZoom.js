/** Tính vùng ảnh thật của object-fit: contain; kính lúp không soi phần đệm quanh ảnh. */
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
export function containedImage(rect, naturalWidth, naturalHeight) {
  if (
    !rect ||
    ![rect.width, rect.height, naturalWidth, naturalHeight].every(
      (n) => Number.isFinite(n) && n > 0,
    )
  )
    return null;
  const fit = Math.min(rect.width / naturalWidth, rect.height / naturalHeight),
    width = naturalWidth * fit,
    height = naturalHeight * fit;
  return {
    left: rect.left + (rect.width - width) / 2,
    top: rect.top + (rect.height - height) / 2,
    width,
    height,
  };
}
export function imageZoomView({ image, frame, point, viewport, scale = 2.5 }) {
  if (
    !image ||
    !frame ||
    !point ||
    viewport.width < 960 ||
    point.x < image.left ||
    point.x > image.left + image.width ||
    point.y < image.top ||
    point.y > image.top + image.height
  )
    return null;
  const left = frame.right + 16,
    width = Math.min(420, viewport.width - left - 16),
    height = Math.min(420, viewport.height - 32);
  if (width < 240 || height < 200) return null;
  const top = clamp(frame.top, 16, viewport.height - height - 16),
    factor = Math.max(scale, width / image.width, height / image.height);
  const lensWidth = width / factor,
    lensHeight = height / factor;
  const lens = {
    left: clamp(
      point.x - lensWidth / 2,
      image.left,
      image.left + image.width - lensWidth,
    ),
    top: clamp(
      point.y - lensHeight / 2,
      image.top,
      image.top + image.height - lensHeight,
    ),
    width: lensWidth,
    height: lensHeight,
  };
  return {
    lens,
    panel: { left, top, width, height },
    detail: {
      width: image.width * factor,
      height: image.height * factor,
      left: -(lens.left - image.left) * factor,
      top: -(lens.top - image.top) * factor,
    },
  };
}
