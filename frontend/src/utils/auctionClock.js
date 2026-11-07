/** Đồng hồ trình bày theo mốc SQL; hết giờ trên trình duyệt không tự quyết định người thắng. */
export function observeAuctionClock(row,observedAt) {
  const server=Date.parse(row.server_time),start=Date.parse(row.thoi_gian_bat_dau),end=Date.parse(row.thoi_gian_ket_thuc);
  if(![server,start,end,observedAt].every(Number.isFinite)||end<=start)throw new Error('Chưa đồng bộ được thời gian phiên.');
  return {server,start,end,observedAt};
}
export function auctionTime(clock,state,now) {
  if(state==='da_ket_thuc')return {phase:'closed',seconds:0};
  if(!clock)return {phase:'unknown',seconds:0};
  const current=clock.server+Math.max(0,now-clock.observedAt);
  if(current<clock.start)return {phase:'scheduled',seconds:Math.ceil((clock.start-current)/1000)};
  if(current>=clock.end)return {phase:'closing',seconds:0};
  return {phase:'open',seconds:Math.ceil((clock.end-current)/1000)};
}
export function duration(seconds) {
  return `${Math.floor(seconds/3600)} giờ ${Math.floor(seconds%3600/60)} phút ${seconds%60} giây`;
}
