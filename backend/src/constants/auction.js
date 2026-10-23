/** Stream nghiệp vụ độc lập probe; Redis admission không thay quyết định bền vững trong SQL. */
export const AUCTION=Object.freeze({
  stream:'bookauction:auction:events',group:'bookauction:auction:workers',deadLetter:'bookauction:auction:dead',
  admissionPrefix:'bookauction:auction:request:',closePrefix:'bookauction:auction:close:',
  bidType:'auction.bid.requested',closeType:'auction.expiry.requested',
  minIdleMs:30000,reclaimEveryMs:5000,leaseMs:15000,closeRetrySeconds:10
});
