/** Smoke đặt giá bằng SQL/Redis/API/worker thật; không cần Cloudinary, chỉ tạo/dọn fixture UUID riêng. */
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {createClient} from 'redis';
import {config} from '../backend/src/config/env.js';
import {getPool,closeDatabase,sql} from '../backend/src/config/database.js';
import {createUserModel} from '../backend/src/models/user.model.js';
import {passwords} from '../backend/src/services/password.service.js';
import {createAuctionModel} from '../backend/src/models/auction.model.js';
import {createAuctionLock} from '../backend/src/concurrency/auctionLock.js';
import {createAuctionPublisher} from '../backend/src/events/auctionPublisher.js';
import {createAuctionProcessor} from '../backend/src/processors/auction.processor.js';
import {ensureAuctionGroup,processAuctionMessage} from '../backend/src/events/auctionConsumer.js';
import {AUCTION} from '../backend/src/constants/auction.js';
import {pathToFileURL} from 'node:url';
import {io} from 'socket.io-client';

export async function runAuctionSmoke({realtime=false}={}) {
const base=`http://${config.host}:${config.port}/api`,runId=randomUUID(),secret=randomBytes(24).toString('base64url');
const accounts=[],auctions=[],requests=new Set(),recoveryPrefix=`bookauction:smoke:auction:${runId}:`;
const sockets=[],socketErrors=[];
let pool,redis,stage='readiness',passed=false;
async function watch(input) {
  const socket=io(`http://${config.host}:${config.port}/auctions`,{forceNew:true,timeout:6000,reconnection:false});sockets.push(socket);
  const changes=[];socket.on('auction:changed',value=>{if(!value||Object.keys(value).length!==1||!Number.isInteger(value.auctionId))socketErrors.push('Payload Socket không đúng hợp đồng.');else changes.push(value.auctionId);});
  await new Promise((resolve,reject)=>{socket.once('connect',resolve);socket.once('connect_error',reject);});
  const join=async()=>assert.equal((await socket.timeout(6000).emitWithAck('auction:watch',input)).ok,true);
  await join();return {socket,changes,join};
}
class Client {
  cookie='';token='';
  async call(path,method='GET',body,csrf=true) {
    const response=await fetch(base+path,{method,headers:{...(this.cookie?{cookie:this.cookie}:{}),...(csrf&&this.token?{'x-csrf-token':this.token}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)});
    for(const cookie of response.headers.getSetCookie())if(cookie.startsWith('bookauction.sid='))this.cookie=cookie.split(';')[0];
    const data=await response.json();if(data.csrfToken)this.token=data.csrfToken;return {status:response.status,data};
  }
  async login(email){check(await this.call('/auth/csrf'),200);check(await this.call('/auth/login','POST',{email,mat_khau:secret}),200);}
}
function check(result,status){assert.equal(result.status,status,`${stage}: HTTP ${result.status}, cần ${status}; ${result.data?.error||''}`);return result.data;}
const progress=value=>{stage=value;console.log(`Kiểm tra: ${value}`);};
const moneyInput=(amount='100000')=>({ma_yeu_cau:randomUUID(),muc_gia:amount});
async function sqlNow(){return (await pool.request().query('SELECT SYSUTCDATETIME() AS now')).recordset[0].now;}
async function waitFor(work,message,timeout=45000) {
  const end=Date.now()+timeout;
  while(Date.now()<end){const result=await work();if(result)return result;await delay(100);}
  throw new Error(message);
}
async function awaitResult(client,id,input) {
  return waitFor(async()=>{const result=check(await client.call(`/auctions/${id}/requests/${input.ma_yeu_cau}`),200);return result.trang_thai==='dang_cho_xu_ly'?null:result;},'Worker chưa trả quyết định.');
}
async function submit(client,id,input) {
  requests.add(input.ma_yeu_cau);const result=await client.call(`/auctions/${id}/bids`,'POST',input);
  assert([200,202].includes(result.status),`${stage}: tiếp nhận giá HTTP ${result.status} (${result.data?.error||''})`);
  return result.data.trang_thai==='dang_cho_xu_ly'?awaitResult(client,id,input):result.data;
}
async function counts(id) {
  return (await pool.request().input('id',sql.Int,id).query(`SELECT
    (SELECT COUNT(*) FROM dbo.LuotDatGia WHERE phien_dau_gia_id=@id) AS bids,
    (SELECT COUNT(*) FROM dbo.KetQuaDauGia WHERE phien_dau_gia_id=@id) AS results,
    (SELECT COUNT(*) FROM dbo.GiaoDich g JOIN dbo.KetQuaDauGia k ON k.ket_qua_id=g.ket_qua_id WHERE k.phien_dau_gia_id=@id) AS trades`)).recordset[0];
}
try {
  assert.equal(config.mode,'development','Chỉ chạy smoke trong development.');
  const seller=new Client(),a=new Client(),b=new Client(),admin=new Client();
  const health=check(await seller.call('/health/ready'),200);assert.equal(health.ok,true);
  pool=await getPool();redis=createClient({url:config.redisUrl,disableOfflineQueue:true,socket:{connectTimeout:3000,reconnectStrategy:false}});redis.on('error',()=>{});await redis.connect();
  const users=createUserModel({getPool,sql}),hash=await passwords.hash(secret);
  progress('tạo tài khoản và phiên thử riêng');
  for(const [label,role,client] of [['seller','nguoi_dung',seller],['buyer-a','nguoi_dung',a],['buyer-b','nguoi_dung',b],['admin','admin',admin]]) {
    const user=await users.create({ho_ten:`Smoke đấu giá ${label}`,email:`m5-${label}-${runId}@example.test`,passwordHash:hash,role});accounts.push(user);await client.login(user.email);
  }
  async function createAuction({price='100000',threshold='999999999999999999',step='1000',duration=60000}={}) {
    const input={ma_yeu_cau:randomUUID(),sach:{ten_sach:`SMOKE AUCTION ${runId}`,tinh_trang_sach:'Dữ liệu phần mềm, không phải sách giao dịch thật'},
      bai_dang:{tieu_de:`SMOKE AUCTION ${runId}`,mo_ta_tinh_trang:'Fixture chỉ kiểm thử'},phien:{gia_khoi_diem:price,gia_toi_thieu:threshold,buoc_gia:step,thoi_gian_cho_dat_lai:10},media:[]};
    const created=check(await seller.call('/posts','POST',input),201);
    let detail=check(await seller.call(`/posts/${created.id}`),200);
    check(await admin.call(`/posts/${created.id}/review`,'POST',{quyet_dinh:'phe_duyet',ly_do:'Fixture kiểm thử, không phải thẩm định thật',xac_nhan_quy_hiem:true,row_version:detail.row_version}),200);
    detail=check(await seller.call(`/posts/${created.id}`),200);auctions.push(detail.phien_dau_gia_id);
    const start=new Date((await sqlNow()).getTime()+1200),end=new Date(start.getTime()+duration);
    check(await seller.call(`/posts/${created.id}/activate`,'POST',{row_version:detail.row_version,thoi_gian_bat_dau:start.toISOString(),thoi_gian_ket_thuc:end.toISOString()}),200);
    await waitFor(async()=>{const row=check(await a.call(`/auctions/${detail.phien_dau_gia_id}`),200);assert(!('gia_toi_thieu' in row));return new Date(row.server_time)>=start;},'Phiên chưa bắt đầu.',15000);
    return detail.phien_dau_gia_id;
  }
  const catalog=realtime?await watch({catalog:true}):null;
  const id=await createAuction();
  const watchers=realtime?[await watch({auctionId:id}),await watch({auctionId:id})]:[];
  if(realtime)await waitFor(()=>catalog.changes.includes(id),'Chưa nhận được cập nhật kích hoạt qua Socket.IO.');
  progress('điều kiện đặt giá riêng theo tài khoản');
  assert.equal(check(await seller.call(`/auctions/${id}/bid-status`),200).la_chu_sach,true);
  assert.deepEqual(Object.keys(check(await a.call(`/auctions/${id}/bid-status`),200)).sort(),['duoc_dat_lai_luc','la_chu_sach','server_time']);
  assert.equal(check(await a.call(`/auctions/${id}/bid-status`),200).duoc_dat_lai_luc,null);
  progress('quyền, CSRF và bước giá');
  check(await admin.call(`/auctions/${id}/bids`,'POST',moneyInput()),403);check(await a.call(`/auctions/${id}/bids`,'POST',moneyInput(),false),403);
  assert.equal((await submit(seller,id,moneyInput())).ly_do,'SELLER_CANNOT_BID');
  assert.equal((await submit(a,id,moneyInput('100001'))).ly_do,'INVALID_BID_STEP');
  progress('hai yêu cầu cùng giá và replay cùng mã');
  const first=moneyInput(),second=moneyInput();const results=await Promise.all([submit(a,id,first),submit(b,id,second)]);
  assert.deepEqual(results.map(x=>x.trang_thai).sort(),['bi_tu_choi','da_chap_nhan']);assert.equal((await counts(id)).bids,1);
  if(realtime){
    progress('hai kết nối nhận tín hiệu và cùng snapshot/lịch sử SQL');
    await waitFor(()=>watchers.every(w=>w.changes.includes(id)),'Chưa nhận được tín hiệu sau ghi SQL.');
    const snapshots=await Promise.all([a,b].map(async client=>check(await client.call(`/auctions/${id}`),200)));
    assert.equal(snapshots[0].gia_hien_tai,snapshots[1].gia_hien_tai);assert.deepEqual(snapshots[0].lich_su,snapshots[1].lich_su);
    assert.equal(snapshots[0].lich_su.length,1);assert(!JSON.stringify(snapshots).includes('"gia_toi_thieu":'));
    watchers[1].socket.disconnect();
  }
  const accepted=results[0].trang_thai==='da_chap_nhan'?{client:a,input:first,other:b}:{client:b,input:second,other:a};
  const personal=check(await accepted.client.call(`/auctions/${id}/bid-status`),200);
  assert.equal(new Date(personal.duoc_dat_lai_luc).getTime()-new Date(results.find(x=>x.trang_thai==='da_chap_nhan').thoi_gian_xu_ly).getTime(),10000);
  assert.equal(check(await accepted.other.call(`/auctions/${id}/bid-status`),200).duoc_dat_lai_luc,null);
  assert.equal(check(await accepted.client.call(`/auctions/${id}/bids`,'POST',accepted.input),200).trang_thai,'da_chap_nhan');
  check(await accepted.client.call(`/auctions/${id}/bids`,'POST',{...accepted.input,muc_gia:'101000'}),409);
  check(await accepted.other.call(`/auctions/${id}/requests/${accepted.input.ma_yeu_cau}`),404);
  assert.equal((await submit(accepted.client,id,moneyInput('101000'))).ly_do,'BID_COOLDOWN');
  assert.equal((await submit(accepted.other,id,moneyInput('101000'))).trang_thai,'da_chap_nhan');
  if(realtime){
    progress('mất kết nối: vào lại room và lấy trạng thái SQL hiện tại');
    const watcher=watchers[1];watcher.socket.connect();
    await new Promise((resolve,reject)=>{watcher.socket.once('connect',resolve);watcher.socket.once('connect_error',reject);});await watcher.join();
    const snapshot=check(await accepted.other.call(`/auctions/${id}`),200);
    assert.equal(snapshot.gia_hien_tai,'101000');assert.equal(snapshot.lich_su.length,2);
    assert.deepEqual(check(await a.call(`/auctions/${id}/history`),200).items,snapshot.lich_su);
  }
  progress('tiền 18 chữ số, đạt/vượt ngưỡng và ngưỡng bằng giá khởi điểm');
  const exact=await createAuction({price:'999999999999999991',step:'2'}),big=moneyInput('999999999999999999');
  assert.equal((await submit(a,exact,big)).muc_gia,'999999999999999999');
  const outcome=check(await a.call(`/auctions/${exact}`),200);assert.equal(outcome.trang_thai,'da_ket_thuc');assert.equal(outcome.ket_qua.ly_do_ket_thuc,'dat_gia_toi_thieu');assert.equal(outcome.ket_qua.muc_gia_thang,big.muc_gia);
  await submit(a,exact,big);assert.deepEqual(await counts(exact),{bids:1,results:1,trades:1});
  const equal=await createAuction({threshold:'100000'}),endedWatcher=realtime?await watch({auctionId:equal}):null;
  await submit(a,equal,moneyInput());assert.equal(check(await a.call(`/auctions/${equal}`),200).trang_thai,'da_ket_thuc');
  if(realtime){await waitFor(()=>endedWatcher.changes.includes(equal),'Chưa nhận được cập nhật kết thúc.');const views=await Promise.all([a,b].map(async client=>check(await client.call(`/auctions/${equal}`),200)));assert.deepEqual(views[0].ket_qua,views[1].ket_qua);}
  const over=await createAuction({threshold:'100500'});await submit(a,over,moneyInput('101000'));assert.equal(check(await a.call(`/auctions/${over}`),200).ket_qua.muc_gia_thang,'101000');
  progress('hết hạn có giá dưới ngưỡng và hết hạn không người thắng');
  const timed=await createAuction({duration:realtime?6000:1800}),timedWatcher=realtime?await watch({auctionId:timed}):null;await submit(a,timed,moneyInput());
  const timedResult=await waitFor(async()=>{const row=check(await a.call(`/auctions/${timed}`),200);return row.ket_qua;},'Job chưa chốt phiên hết hạn.');
  assert.equal(timedResult.ly_do_ket_thuc,'het_thoi_gian');assert.equal(timedResult.muc_gia_thang,'100000');assert.deepEqual(await counts(timed),{bids:1,results:1,trades:1});
  if(realtime)await waitFor(()=>timedWatcher.changes.length>=2,'Chưa nhận đủ cập nhật lượt giá và chốt hết hạn.');
  const empty=await createAuction({duration:realtime?3000:1000}),emptyWatcher=realtime?await watch({auctionId:empty}):null;
  const emptyResult=await waitFor(async()=>check(await a.call(`/auctions/${empty}`),200).ket_qua,'Job chưa chốt phiên không có lượt giá.');
  assert.equal(emptyResult.trang_thai,'khong_co_nguoi_thang');assert.deepEqual(await counts(empty),{bids:0,results:1,trades:0});
  if(realtime)await waitFor(()=>emptyWatcher.changes.includes(empty),'Chưa nhận cập nhật hết hạn không người thắng.');
  assert.equal((await submit(a,empty,moneyInput())).trang_thai,'bi_tu_choi');
  progress('phục hồi sau COMMIT trước ACK với stream UUID riêng');
  const recovery=await createAuction(),settings={...AUCTION,stream:recoveryPrefix+'events',group:recoveryPrefix+'workers',deadLetter:recoveryPrefix+'dead',admissionPrefix:recoveryPrefix+'requests:',closePrefix:recoveryPrefix+'close:'};
  const model=createAuctionModel({getPool,sql}),publisher=createAuctionPublisher({getRedis:()=>redis,settings});
  await ensureAuctionGroup(redis,settings);const recoveryId=randomUUID();
  await publisher.bid({auctionId:recovery,userId:accounts[1].nguoi_dung_id,amount:'100000',requestId:recoveryId});
  const handle=createAuctionProcessor({model,locks:createAuctionLock({getRedis:()=>redis,keyPrefix:recoveryPrefix+'lock:'}),settings});
  const received=(await redis.xReadGroup(settings.group,'before-crash',{key:settings.stream,id:'>'},{COUNT:1}))[0].messages[0];
  await processAuctionMessage({client:redis,message:received,handle,settings,beforeAck:async()=>{throw Error('simulated crash after COMMIT');}});
  assert.equal((await counts(recovery)).bids,1);assert.equal((await redis.xPending(settings.stream,settings.group)).pending,1);
  const claimed=await redis.xAutoClaim(settings.stream,settings.group,'replacement',0,'0-0',{COUNT:10});assert.equal(claimed.messages.length,1);
  await processAuctionMessage({client:redis,message:claimed.messages[0],handle,settings});
  assert.equal((await redis.xPending(settings.stream,settings.group)).pending,0);assert.equal((await counts(recovery)).bids,1);
  assert.equal(check(await a.call(`/auctions/${recovery}/requests/${recoveryId}`),200).trang_thai,'da_chap_nhan');
  assert.deepEqual(socketErrors,[]);passed=true;
} catch(error) {
  console.error(`FAIL đấu giá tại ${stage}; run=${runId}.`,error.name==='AssertionError'?error.message:'Kiểm tra terminal API/worker, migration SQL và kết nối Redis.');process.exitCode=1;
} finally {
  sockets.forEach(socket=>socket.disconnect());
  if(accounts.length)try {
    pool ||= await getPool();
    // Stop deleting if an API-admitted request is still pending; keep its SQL references for the worker.
    for(const code of requests)await waitFor(async()=>{const ttl=await redis.ttl(AUCTION.admissionPrefix+code);return ttl===-2||ttl>0;},'Còn yêu cầu pending; giữ fixture để đối soát.',5000);
    const req=pool.request();accounts.forEach((user,i)=>req.input('u'+i,sql.Int,user.nguoi_dung_id));const ids=accounts.map((_,i)=>'@u'+i).join(',');
    await req.query(`SET XACT_ABORT ON;BEGIN TRANSACTION;
      DECLARE @p TABLE(id INT);DECLARE @a TABLE(id INT);DECLARE @b TABLE(id INT);
      INSERT @p SELECT bai_dang_id FROM dbo.BaiDang WITH (UPDLOCK,HOLDLOCK) WHERE nguoi_dung_id IN (${ids});
      INSERT @a SELECT phien_dau_gia_id FROM dbo.PhienDauGia WHERE bai_dang_id IN(SELECT id FROM @p);
      INSERT @b SELECT sach_id FROM dbo.BaiDang WHERE bai_dang_id IN(SELECT id FROM @p);
      DELETE dbo.GiaoDich WHERE ket_qua_id IN(SELECT ket_qua_id FROM dbo.KetQuaDauGia WHERE phien_dau_gia_id IN(SELECT id FROM @a));
      DELETE dbo.KetQuaDauGia WHERE phien_dau_gia_id IN(SELECT id FROM @a);DELETE dbo.YeuCauDatGia WHERE phien_dau_gia_id IN(SELECT id FROM @a);
      DELETE dbo.LuotDatGia WHERE phien_dau_gia_id IN(SELECT id FROM @a);DELETE dbo.LichSuDauGia WHERE phien_dau_gia_id IN(SELECT id FROM @a);
      DELETE dbo.KiemDuyet WHERE bai_dang_id IN(SELECT id FROM @p);DELETE dbo.PhienDauGia WHERE phien_dau_gia_id IN(SELECT id FROM @a);
      DELETE dbo.ChiTietPhanTichAI WHERE phan_tich_id IN(SELECT phan_tich_id FROM dbo.PhanTichAI WHERE bai_dang_id IN(SELECT id FROM @p));
      DELETE dbo.PhanTichAI WHERE bai_dang_id IN(SELECT id FROM @p);
      DELETE dbo.BaiDang WHERE bai_dang_id IN(SELECT id FROM @p);DELETE dbo.Sach WHERE sach_id IN(SELECT id FROM @b);
      DELETE dbo.NguoiDung WHERE nguoi_dung_id IN (${ids});COMMIT TRANSACTION;`);
    const keys=[...requests].map(code=>AUCTION.admissionPrefix+code).concat(auctions.map(id=>AUCTION.closePrefix+id),await redis.keys(recoveryPrefix+'*'));
    if(keys.length)await redis.del(keys);console.log('Đã dọn dữ liệu thử SQL và khóa Redis thuộc lần chạy.');
  }catch{console.error(`Chưa dọn xong fixture run=${runId}; tài khoản ID=${accounts.map(x=>x.nguoi_dung_id).join(',')}. Giữ để đối soát; không xóa database/volume.`);process.exitCode=1;}
  if(redis?.isOpen)redis.destroy();await closeDatabase();
}
if(passed&&!process.exitCode)console.log('PASS đấu giá: quyền/CSRF, Streams → worker → SQL, giá/cooldown, tranh chấp, replay, 18 chữ số, hai kiểu kết thúc, một kết quả/giao dịch và phục hồi sau COMMIT trước ACK.');
if(passed&&realtime&&!process.exitCode)console.log('PASS thời gian thực: kích hoạt, hai kết nối, lịch sử/kết quả SQL, đăng ký lại room và lấy lại snapshot sau mất kết nối; không lộ ngưỡng giá.');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await runAuctionSmoke();
