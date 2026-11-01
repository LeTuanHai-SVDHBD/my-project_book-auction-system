/** Tiến độ chỉ dùng khi Admin đang xem job; không khẳng định đã có kết quả SQL. */
export function aiProgressMessage(job) {
  const p = job?.progress || {};
  if (job?.state !== "running") return "Đang chờ AI xử lý…";
  const number = (value) =>
    Number.isSafeInteger(value) && value >= 0 ? value : 0;
  const attempt = number(p.attempt),
    max = number(p.max_attempts),
    seconds = Math.ceil(number(p.provider_timeout_ms) / 1000);
  const mediaId=/^M\d+$/.test(p.media_id||'')?p.media_id:'video';
  if(p.phase==='video_download')return `Đang lấy ${mediaId} từ Cloudinary để gửi AI…`;
  if(p.phase==='video_upload')return `Đang chuyển ${mediaId} sang Gemini Files API…`;
  if(p.phase==='video_processing')return `Gemini đang chuẩn bị ${mediaId}; video dài có thể cần vài phút…`;
  if (p.phase === "media")
    return `Đang chuẩn bị ảnh/video: ${number(p.media_completed)}/${number(p.media_total)} tệp…`;
  if (p.phase === "retry")
    return `Gemini gặp lỗi tạm thời. Đang chuẩn bị thử lượt ${Math.min(attempt + 1, max)}/${max}…`;
  if (p.phase === "provider")
    return `Đang chờ Gemini trả kết quả (lượt ${attempt}/${max}, tối đa ${seconds} giây/lượt)…`;
  return "Đang phân tích sách…";
}
