/** Cloudinary và giới hạn kỹ thuật upload; không đưa bí mật vào cấu hình trả cho React. */
export function parseMediaConfig(env) {
  const integer = (name, fallback, max) => {
    const value = Number(env[name] || fallback);
    if (!Number.isInteger(value) || value < 1 || value > max) throw new Error(`${name} không hợp lệ.`);
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
    maxImages: integer('MEDIA_MAX_IMAGES', 12, 30), maxVideos: integer('MEDIA_MAX_VIDEOS', 3, 5),
    pendingSeconds: 3600, uploadTimeoutMs: 120000 };
}
export function publicMediaConfig(config) {
  return { configured: config.configured, imageMaxBytes: config.imageMaxBytes, videoMaxBytes: config.videoMaxBytes,
    maxImages: config.maxImages, maxVideos: config.maxVideos,
    imageTypes: ['image/jpeg', 'image/png', 'image/webp'], videoTypes: ['video/mp4', 'video/webm'] };
}
