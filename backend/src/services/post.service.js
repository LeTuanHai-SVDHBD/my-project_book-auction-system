/** Điều phối upload/SQL: chỉ nhận vé của chủ sách, không gọi Cloudinary trong transaction. */
export function createPostService({ model, ledger, limits, notify=async()=>{}, enqueueAi=async()=>{}, log=()=>{} }) {
  async function analyzeAfterCommit(result){try{await enqueueAi(result.id);}catch(error){log(error,{component:'ai-enqueue'});}return result;}
  async function attach(owner,input,operation) {
    const claim=await ledger.claim(owner,input.media);
    try {
      const result=await operation(claim.items);
      // SQL already committed. Redis acknowledgement must not turn a success into a false rollback.
      try { if (result.replayed) await ledger.release(claim); else await ledger.bound(claim); } catch(error) { log(error,{component:'media-bind-reconcile'}); }
      return result;
    } catch(error) {
      if (error.sqlRolledBack===true) { try { await ledger.release(claim); } catch(failure) { log(failure,{component:'media-release'}); } }
      throw error;
    }
  }
  return {
    async create(owner,input,sourceId=null) {
      const code=`BK${input.requestId.replaceAll('-','')}`;
      const existing=await model.findRequest(code,owner);
      if (existing) return analyzeAfterCommit({id:existing,replayed:true});
      return analyzeAfterCommit(await attach(owner,input,items=>model.create({owner,input,sourceId,code,items,limits})));
    },
    resubmit: async(owner,postId,input)=>analyzeAfterCommit(await attach(owner,input,items=>model.resubmit({owner,postId,input,items,limits}))),
    review: (admin,postId,input)=>model.review({admin,postId,input}),
    async activate(owner,postId,input) {
      const result=await model.activate({owner,postId,input});
      try{if(result.auctionId)await notify(result.auctionId);}catch(error){log(error,{component:'activation-notify'});}
      return result;
    },
  };
}
