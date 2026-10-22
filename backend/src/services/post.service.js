/** Điều phối upload/SQL: chỉ nhận vé của chủ sách, không gọi Cloudinary trong transaction. */
export function createPostService({ model, ledger, limits, log=()=>{} }) {
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
      if (existing) return {id:existing,replayed:true};
      return attach(owner,input,items=>model.create({owner,input,sourceId,code,items,limits}));
    },
    resubmit: (owner,postId,input)=>attach(owner,input,items=>model.resubmit({owner,postId,input,items,limits})),
    review: (admin,postId,input)=>model.review({admin,postId,input}),
    activate: (owner,postId,input)=>model.activate({owner,postId,input}),
  };
}
