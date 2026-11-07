/** Shared binary format recognition. Extensions and browser MIME are hints, never proof. */
export const mediaFormats = [
  ["image", "image/jpeg", "jpg,jpeg,jfif"],
  ["image", "image/png", "png"],
  ["image", "image/webp", "webp"],
  ["image", "image/gif", "gif"],
  ["image", "image/bmp", "bmp"],
  ["image", "image/tiff", "tif,tiff"],
  ["image", "image/avif", "avif"],
  ["image", "image/heic", "heic"],
  ["image", "image/heif", "heif"],
  ["video", "video/mp4", "mp4"],
  ["video", "video/x-m4v", "m4v"],
  ["video", "video/quicktime", "mov,qt"],
  ["video", "video/webm", "webm"],
  ["video", "video/x-matroska", "mkv"],
  ["video", "video/x-msvideo", "avi"],
].map(([kind, mime, extensions]) => ({
  kind,
  mime,
  extensions: extensions.split(","),
}));
export const mediaAccept = mediaFormats
  .flatMap((x) => [x.mime, ...x.extensions.map((ext) => "." + ext)])
  .join(",");
export const mediaFormatLabel =
  "JPG/JPEG, PNG, WebP, GIF, BMP, TIFF, AVIF, HEIC/HEIF; MP4, M4V, MOV, WebM, MKV, AVI";
export function detectMedia(input) {
  const b = input instanceof Uint8Array ? input : new Uint8Array(input);
  const text = (start, length) =>
    String.fromCharCode(...b.subarray(start, start + length));
  const prefix = (...values) => values.every((value, i) => b[i] === value);
  let mime;
  if (prefix(255, 216, 255)) mime = "image/jpeg";
  else if (prefix(137, 80, 78, 71, 13, 10, 26, 10)) mime = "image/png";
  else if (["GIF87a", "GIF89a"].includes(text(0, 6))) mime = "image/gif";
  else if (text(0, 2) === "BM") mime = "image/bmp";
  else if (prefix(73, 73, 42, 0) || prefix(77, 77, 0, 42)) mime = "image/tiff";
  else if (text(0, 4) === "RIFF" && b.length >= 12) {
    if (text(8, 4) === "WEBP") mime = "image/webp";
    if (text(8, 4) === "AVI ") mime = "video/x-msvideo";
  } else if (text(4, 4) === "ftyp" && b.length >= 16) {
    const size = new DataView(b.buffer, b.byteOffset, b.byteLength).getUint32(
      0,
    );
    // Bound the brand box and ignore the minor-version word at offset 12.
    if (size < 16 || size > b.length || size > 65536 || size % 4) return null;
    const brands = [text(8, 4)];
    for (let i = 16; i < size; i += 4) brands.push(text(i, 4));
    if (brands.some((x) => ["avif", "avis"].includes(x))) mime = "image/avif";
    else if (brands.some((x) => ["heic", "heix", "hevc", "hevx"].includes(x)))
      mime = "image/heic";
    else if (brands.some((x) => ["mif1", "msf1"].includes(x)))
      mime = "image/heif";
    else if (brands.includes("qt  ")) mime = "video/quicktime";
    else if (brands.some((x) => ["M4V ", "M4VH", "M4VP"].includes(x)))
      mime = "video/x-m4v";
    else if (
      brands.some((x) => /^(isom|iso[2-9]|mp4[12]|avc1|dash|MSNV)$/.test(x))
    )
      mime = "video/mp4";
  } else if (prefix(26, 69, 223, 163)) {
    // Parse the EBML header and DocType instead of treating every EBML file as WebM.
    const vint = (offset) => {
      const first = b[offset];
      if (!first) return null;
      let n = 1,
        mask = 128;
      while (!(first & mask) && n <= 8) {
        mask >>= 1;
        n++;
      }
      if (n > 8 || offset + n > b.length) return null;
      let value = first & (mask - 1);
      for (let i = 1; i < n; i++) value = value * 256 + b[offset + i];
      return Number.isSafeInteger(value) ? { n, value } : null;
    };
    const header = vint(4);
    if (!header || header.value > 65536) return null;
    const end = 4 + header.n + header.value;
    if (end > b.length) return null;
    for (let p = 4 + header.n; p < end; ) {
      const start = p,
        id = vint(p);
      if (!id || id.n > 4) return null;
      p += id.n;
      const size = vint(p);
      if (!size) return null;
      p += size.n;
      if (p + size.value > end) return null;
      if (b[start] === 0x42 && b[start + 1] === 0x82 && id.n === 2) {
        if (size.value > 8) return null;
        const type = text(p, size.value);
        if (type === "webm") mime = "video/webm";
        if (type === "matroska") mime = "video/x-matroska";
        break;
      }
      p += size.value;
    }
  }
  return mediaFormats.find((x) => x.mime === mime) || null;
}
