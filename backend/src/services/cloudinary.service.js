/** Cloudinary REST phía server; không nhận URL tùy ý, không đưa bí mật vào phản hồi/lỗi. */
import { HttpError } from '../middlewares/errorHandler.js';
export function createCloudinary({ config, fetchImpl = fetch }) {
  const endpoint = kind => `https://api.cloudinary.com/v1_1/${config.cloudName}/${kind}`;
  const headers = { Authorization: `Basic ${Buffer.from(`${config.apiKey}:${config.apiSecret}`).toString('base64')}` };
  async function call(url, body) {
    if (!config.configured) throw new HttpError(503, 'MEDIA_NOT_CONFIGURED', 'Chưa cấu hình Cloudinary trên API.');
    try {
      const response = await fetchImpl(url, { method: 'POST', headers, body, signal: AbortSignal.timeout(config.uploadTimeoutMs) });
      if (!response.ok) throw new Error('Provider rejected request');
      return await response.json();
    } catch { throw new HttpError(502, 'MEDIA_PROVIDER_ERROR', 'Cloudinary chưa xử lý được tệp. Vui lòng thử lại.'); }
  }
  return {
    async upload({ kind, publicId, bytes, mime }) {
      const form = new FormData();
      form.set('file', new Blob([bytes], { type: mime }), 'upload');
      form.set('public_id', publicId); form.set('overwrite', 'false');
      const result = await call(`${endpoint(kind)}/upload`, form);
      let url; try { url = new URL(result.secure_url); } catch { /* handled below */ }
      if (result.public_id !== publicId || result.resource_type !== kind || !url || url.protocol !== 'https:' || url.hostname !== 'res.cloudinary.com' || !url.pathname.startsWith(`/${config.cloudName}/`) || result.secure_url.length > 2048) {
        throw new HttpError(502, 'INVALID_MEDIA_RESPONSE', 'Cloudinary trả về dữ liệu không hợp lệ.');
      }
      return { url: result.secure_url, publicId, kind };
    },
    async destroy({ kind, publicId }) {
      const result = await call(`${endpoint(kind)}/destroy`, new URLSearchParams({ public_id: publicId, invalidate: 'true' }));
      if (!['ok', 'not found'].includes(result.result)) throw new HttpError(502, 'MEDIA_DELETE_FAILED', 'Chưa xóa được media.');
    },
  };
}
export function verifyMedia(bytes, mime, kind) {
  const prefix = value => bytes.subarray(0, value.length).equals(Buffer.from(value));
  const valid = kind === 'image' ? (
    mime === 'image/jpeg' && prefix([255,216,255]) ||
    mime === 'image/png' && prefix([137,80,78,71,13,10,26,10]) ||
    mime === 'image/webp' && bytes.toString('ascii',0,4) === 'RIFF' && bytes.toString('ascii',8,12) === 'WEBP'
  ) : (
    mime === 'video/mp4' && bytes.toString('ascii',4,8) === 'ftyp' ||
    mime === 'video/webm' && prefix([26,69,223,163])
  );
  if (!valid) throw new HttpError(415, 'INVALID_MEDIA_TYPE', 'Nội dung tệp không khớp định dạng được hỗ trợ.');
}
