/** Cloudinary và giới hạn kỹ thuật upload; không đưa bí mật vào cấu hình trả cho React. */
import {mediaFormats,mediaAccept,mediaFormatLabel} from '../../../shared/mediaFormats.js';
export function parseMediaConfig(env) {
  const integer = (name, fallback, max, min=1) => {
    const value = Number(env[name] || fallback);
    if (!Number.isInteger(value) || value < min || value > max) throw new Error(`${name} không hợp lệ.`);
    return value;
  };
  const cloudName = env.CLOUDINARY_CLOUD_NAME || '';
  const apiKey = env.CLOUDINARY_API_KEY || '';
  const apiSecret = env.CLOUDINARY_API_SECRET || '';
  const configured = [cloudName, apiKey, apiSecret].every(value => value && !value.includes('CHANGE_ME'));
  if (configured && !/^[a-zA-Z0-9_-]+$/.test(cloudName)) throw new Error('CLOUDINARY_CLOUD_NAME không hợp lệ.');
  return { cloudName, apiKey, apiSecret, configured,
    imageMaxBytes: integer('MEDIA_IMAGE_MAX_MB', 10, 20) * 1024 * 1024,
    videoMaxBytes: integer('MEDIA_VIDEO_MAX_MB', 50, 100) * 1024 * 1024,
    maxImages: null, maxVideos: integer('MEDIA_MAX_VIDEOS', 3, 5),
    pendingSeconds: 3600,
    uploadTimeoutMs: integer('MEDIA_IMAGE_UPLOAD_TIMEOUT_MS',120000,300000,1000),
    videoUploadTimeoutMs: integer('MEDIA_VIDEO_UPLOAD_TIMEOUT_MS',300000,300000,1000),
    recoveryTimeoutMs: integer('MEDIA_RECOVERY_TIMEOUT_MS',15000,30000,1000),recoveryAttempts:3,recoveryDelayMs:1000 };
}
export function publicMediaConfig(config) {
  return { configured: config.configured, imageMaxBytes: config.imageMaxBytes, videoMaxBytes: config.videoMaxBytes,
    maxImages: config.maxImages, maxVideos: config.maxVideos,
    uploadTimeoutMs: {image:mediaUploadBudget(config,'image'),video:mediaUploadBudget(config,'video')},
    accept:mediaAccept,formatLabel:mediaFormatLabel,
    imageTypes: mediaFormats.filter(x=>x.kind==='image').map(x=>x.mime), videoTypes: mediaFormats.filter(x=>x.kind==='video').map(x=>x.mime) };
}

// Client includes time for the incoming binary body (Node request timeout), provider and bounded recovery.
export function mediaUploadBudget(config,kind) {return (kind==='video'?(config.videoUploadTimeoutMs||300000):config.uploadTimeoutMs)+(config.recoveryAttempts||3)*(config.recoveryTimeoutMs||15000)+Math.max(0,(config.recoveryAttempts||3)-1)*(config.recoveryDelayMs??1000)+310000;}
