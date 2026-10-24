/** Nghiệm thu Socket.IO với SQL/Redis/API/worker thật; dùng cùng fixture và cleanup của smoke đấu giá. */
import {runAuctionSmoke} from './smokeM5.mjs';
await runAuctionSmoke({realtime:true});
