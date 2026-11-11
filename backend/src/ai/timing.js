/** Trung bình thực nghiệm theo tải tương tự; không dùng timeout làm thời gian dự kiến. */
import {analysisInput} from './input.js';
const bucket=(value,limits)=>limits.findIndex(limit=>value<=limit);
export function analysisWorkload(row,manifest=[]) {
  const input=analysisInput(row),videos=manifest.filter(x=>x.kind==='video'&&x.sent);
  const seconds=videos.length&&videos.every(x=>Number.isFinite(x.duration_seconds))
    ?videos.reduce((sum,x)=>sum+x.duration_seconds,0):null;
  const bytes=manifest.length&&manifest.every(x=>Number.isFinite(x.bytes))
    ?manifest.reduce((sum,x)=>sum+x.bytes,0):null;
  return {version:1,text_chars:JSON.stringify(input.book).length,
    images:input.media.filter(x=>x.kind==='image').length,videos:input.media.filter(x=>x.kind==='video').length,
    video_seconds:seconds,media_bytes:bytes};
}
export function averageAnalysisTime(target,samples) {
  const group=w=>[bucket(w.text_chars,[2000,6000,Infinity]),bucket(w.images,[5,15,30,Infinity]),w.videos].join(':');
  const valid=w=>w?.version===1&&['text_chars','images','videos'].every(k=>Number.isSafeInteger(w[k])&&w[k]>=0);
  const matches=valid(target)?samples.filter(s=>valid(s.workload)&&group(s.workload)===group(target)
    &&(target.video_seconds==null||s.workload.video_seconds!=null&&bucket(s.workload.video_seconds,[60,300,Infinity])===bucket(target.video_seconds,[60,300,Infinity]))
    &&(target.media_bytes==null||s.workload.media_bytes!=null&&bucket(s.workload.media_bytes,[5*1048576,20*1048576,Infinity])===bucket(target.media_bytes,[5*1048576,20*1048576,Infinity]))
    &&Number.isSafeInteger(s.execution?.total_ms)&&s.execution.total_ms>0&&s.execution.total_ms<=86400000).slice(0,20):[];
  return {sample_count:matches.length,minimum_samples:5,
    average_ms:matches.length>=5?Math.round(matches.reduce((sum,s)=>sum+s.execution.total_ms,0)/matches.length):null,
    workload:target};
}
