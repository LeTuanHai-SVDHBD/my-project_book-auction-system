/** Nghiệm thu M8 dùng chung fixture đấu giá và cleanup SQL/Redis có khóa, không xóa dữ liệu người dùng. */
import {runAuctionSmoke} from './smokeM5.mjs';
await runAuctionSmoke({afterSales:true});
