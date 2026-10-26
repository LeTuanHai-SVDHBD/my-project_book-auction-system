/** Namespace chỉ đọc dữ liệu công khai; room do server chọn sau khi kiểm tra phiên đã công bố. */
import {parseAuctionId} from '../services/auction.service.js';
export function attachAuctionSockets({io,model,log=()=>{}}) {
  const namespace=io.of('/auctions');
  namespace.on('connection',socket=>{
    let revision=0,windowAt=Date.now(),requests=0;
    socket.on('auction:watch',async(input,ack)=>{
      if(typeof ack!=='function')return;
      if(Date.now()-windowAt>=1000){windowAt=Date.now();requests=0;}
      if(++requests>10){ack({ok:false,error:'RATE_LIMITED'});return;}
      const current=++revision;
      try {
        if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>!['auctionId','catalog'].includes(key)))throw Error('INVALID_WATCH');
        if(input.catalog===true&&input.auctionId===undefined) {
          await socket.join('catalog');ack({ok:true});return;
        }
        if(input.catalog!==undefined||typeof input.auctionId!=='number')throw Error('INVALID_WATCH');
        const id=parseAuctionId(input.auctionId);
        if(!await model.publicAuction(id)){ack({ok:false,error:'AUCTION_NOT_FOUND'});return;}
        if(!socket.connected||current!==revision){ack({ok:false,error:'WATCH_SUPERSEDED'});return;}
        for(const room of socket.rooms)if(room.startsWith('auction:'))await socket.leave(room);
        await socket.join(`auction:${id}`);ack({ok:true});
      } catch(error){log(error,{component:'auction-watch'});ack({ok:false,error:'WATCH_UNAVAILABLE'});}
    });
    // There are no bid commands, user rooms or private payloads on this namespace.
  });
  return {changed(auctionId){namespace.to(`auction:${auctionId}`).to('catalog').emit('auction:changed',{auctionId});}};
}
