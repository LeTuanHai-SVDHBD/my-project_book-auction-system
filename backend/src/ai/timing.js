/** Ước tính sơ bộ từ tải hồ sơ, không cần lịch sử hoặc lấy timeout làm dự báo. */
import {analysisInput} from './input.js';
export function analysisWorkload(row,manifest=[]) {
  const input=analysisInput(row),videos=manifest.filter(x=>x.kind==='video'&&x.sent);
  const seconds=videos.length===input.media.filter(x=>x.kind==='video').length&&videos.length&&videos.every(x=>Number.isFinite(x.duration_seconds))
    ?videos.reduce((sum,x)=>sum+x.duration_seconds,0):null;
  const bytes=manifest.length===input.media.length&&manifest.length&&manifest.every(x=>Number.isFinite(x.bytes))
    ?manifest.reduce((sum,x)=>sum+x.bytes,0):null;
  return {version:1,text_chars:Object.values(input.book).filter(x=>x!=null).map(String).join("\n").length,
    images:input.media.filter(x=>x.kind==='image').length,videos:input.media.filter(x=>x.kind==='video').length,
    video_seconds:seconds,media_bytes:bytes};
}
// Các hệ số là giả định kỹ thuật cho ước tính sơ bộ, chưa phải số liệu đo của Gemini.
// Trả khoảng thời gian để không tạo cảm giác chính xác hoặc bảo đảm hoàn tất.
export function estimateAnalysisTime(workload) {
  const units=Math.ceil(Math.max(0,workload.text_chars)/2000);
  const bytes=Number.isFinite(workload.media_bytes)?Math.max(0,workload.media_bytes)/1048576:0;
  const videoKnown=workload.videos>0&&Number.isFinite(workload.video_seconds);
  const seconds=videoKnown?Math.max(0,workload.video_seconds):0;
  const lower=20+2*units+workload.images+bytes*0.1
    +(videoKnown?15*workload.videos+seconds*0.1:30*workload.videos);
  const upper=45+4*units+4*workload.images+bytes*0.7
    +(videoKnown?40*workload.videos+seconds*0.4:120*workload.videos);
  return {method:'workload-heuristic-v1',
    estimated_min_ms:Math.ceil(lower/5)*5000,estimated_max_ms:Math.ceil(upper/5)*5000,
    video_duration_known:videoKnown,workload};
}
