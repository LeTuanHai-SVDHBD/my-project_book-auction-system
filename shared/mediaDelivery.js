/** Browser/AI conversions preserve the stored original URL and never crop evidence. */
export function mediaDisplayUrl(raw, kind) {
  try {
    const url = new URL(raw);
    if (
      url.protocol !== "https:" ||
      url.hostname !== "res.cloudinary.com" ||
      url.username ||
      url.password ||
      url.port
    )
      return raw;
    const marker = `/${kind}/upload/`;
    if (!url.pathname.includes(marker)) return raw;
    const ext = url.pathname.split(".").at(-1).toLowerCase();
    const convert =
      kind === "image"
        ? ["heic", "heif", "tif", "tiff", "bmp", "avif", "gif"].includes(ext)
        : ["mov", "qt", "m4v", "mkv", "avi"].includes(ext);
    if (!convert) return raw;
    url.pathname = url.pathname
      .replace(
        marker,
        marker + (kind === "image" ? "f_jpg/" : "f_mp4,vc_h264,ac_aac/"),
      )
      .replace(/\.[^.\/]+$/, kind === "image" ? ".jpg" : ".mp4");
    return url.href;
  } catch {
    return raw;
  }
}
