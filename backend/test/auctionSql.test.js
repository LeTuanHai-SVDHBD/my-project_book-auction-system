/** SQL Server/Redis thật opt-in; chỉ database BookAuctionTest_*, tạo/dọn fixture UUID riêng. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {setTimeout as delay} from 'node:timers/promises';
import {createClient} from 'redis';
import {createAuctionModel} from '../src/models/auction.model.js';
import {createAuctionLock} from '../src/concurrency/auctionLock.js';
import {createAuctionProcessor} from '../src/processors/auction.processor.js';
import {createAuctionPublisher} from '../src/events/auctionPublisher.js';
import {ensureAuctionGroup,processAuctionMessage} from '../src/events/auctionConsumer.js';
import {scanExpired} from '../src/jobs/auctionExpiry.js';
import {AUCTION} from '../src/constants/auction.js';

test('SQL/Redis thật: migration, tranh chấp, quyết định bền vững, kết thúc nguyên tử và phục hồi pending',
  {skip:process.env.AUCTION_TEST_SQL!=='true',timeout:90000},async t=>{
    assert.match(process.env.DB_DATABASE||'',/^BookAuctionTest_[A-Za-z0-9_]+$/,'Chỉ dùng database kiểm thử riêng BookAuctionTest_*.');
    assert(process.env.AUTH_TEST_REDIS_URL,'Cần Redis kiểm thử riêng.');
    const {config}=await import('../src/config/env.js');
    const {sql,getPool,closeDatabase}=await import('../src/config/database.js');
    const master=await new sql.ConnectionPool({...config.sql,database:'master'}).connect();
    try{await master.request().query(`IF DB_ID('${config.sql.database}') IS NULL CREATE DATABASE [${config.sql.database}]`);}finally{await master.close();}
    const pool=await getPool();let cleanup=async()=>{};
    t.after(async()=>{try{await cleanup();}finally{await closeDatabase();}});
    const found=(await pool.request().query("SELECT OBJECT_ID('dbo.PhienDauGia') AS id")).recordset[0].id;
    if(!found) {
      const ddl=await readFile(new URL('../migrations/001_schema.sql',import.meta.url),'utf8');
      for(const batch of ddl.replace(/^\uFEFF/,'').split(/^\s*GO\s*(?:--[^\n]*)?$/gim).filter(x=>x.trim()))await pool.request().batch(batch);
    }
    for(const name of ['002_cloudinary_metadata.sql','003_auction_decisions.sql'])await pool.request().batch(await readFile(new URL('../migrations/'+name,import.meta.url),'utf8'));
    const redis=createClient({url:process.env.AUTH_TEST_REDIS_URL,disableOfflineQueue:true,socket:{connectTimeout:3000,reconnectStrategy:false}});redis.on('error',()=>{});await redis.connect();
    const runId=randomUUID(),prefix=`bookauction:test:sql:${runId}:`,settings={...AUCTION,stream:prefix+'events',group:prefix+'group',deadLetter:prefix+'dead',admissionPrefix:prefix+'request:',closePrefix:prefix+'close:'};
    const publisher=createAuctionPublisher({getRedis:()=>redis,settings}),model=createAuctionModel({getPool,sql});
    const userIds=[];
    cleanup=async()=>{
      if(redis.isReady){const keys=await redis.keys(prefix+'*');if(keys.length)await redis.del(keys);}if(redis.isOpen)redis.destroy();
      if(userIds.length) {
        const req=pool.request();userIds.forEach((id,i)=>req.input('u'+i,sql.Int,id));const ids=userIds.map((_,i)=>'@u'+i).join(',');
        await req.query(`SET XACT_ABORT ON;BEGIN TRANSACTION;
          DECLARE @p TABLE(id INT);DECLARE @a TABLE(id INT);DECLARE @b TABLE(id INT);
          INSERT @p SELECT bai_dang_id FROM dbo.BaiDang WHERE nguoi_dung_id IN (${ids});
          INSERT @a SELECT phien_dau_gia_id FROM dbo.PhienDauGia WHERE bai_dang_id IN(SELECT id FROM @p);
          INSERT @b SELECT sach_id FROM dbo.BaiDang WHERE bai_dang_id IN(SELECT id FROM @p);
          DELETE dbo.BangChungKhieuNai WHERE khieu_nai_id IN(SELECT khieu_nai_id FROM dbo.KhieuNai WHERE giao_dich_id IN(SELECT giao_dich_id FROM dbo.GiaoDich WHERE ket_qua_id IN(SELECT ket_qua_id FROM dbo.KetQuaDauGia WHERE phien_dau_gia_id IN(SELECT id FROM @a))));
      DELETE dbo.KhieuNai WHERE giao_dich_id IN(SELECT giao_dich_id FROM dbo.GiaoDich WHERE ket_qua_id IN(SELECT ket_qua_id FROM dbo.KetQuaDauGia WHERE phien_dau_gia_id IN(SELECT id FROM @a)));
      DELETE dbo.TinNhan WHERE cuoc_tro_chuyen_id IN(SELECT cuoc_tro_chuyen_id FROM dbo.CuocTroChuyen WHERE giao_dich_id IN(SELECT giao_dich_id FROM dbo.GiaoDich WHERE ket_qua_id IN(SELECT ket_qua_id FROM dbo.KetQuaDauGia WHERE phien_dau_gia_id IN(SELECT id FROM @a))));
      DELETE dbo.CuocTroChuyen WHERE giao_dich_id IN(SELECT giao_dich_id FROM dbo.GiaoDich WHERE ket_qua_id IN(SELECT ket_qua_id FROM dbo.KetQuaDauGia WHERE phien_dau_gia_id IN(SELECT id FROM @a)));
      DELETE dbo.DanhGia WHERE giao_dich_id IN(SELECT giao_dich_id FROM dbo.GiaoDich WHERE ket_qua_id IN(SELECT ket_qua_id FROM dbo.KetQuaDauGia WHERE phien_dau_gia_id IN(SELECT id FROM @a)));
      DELETE dbo.GiaoDich WHERE ket_qua_id IN(SELECT ket_qua_id FROM dbo.KetQuaDauGia WHERE phien_dau_gia_id IN(SELECT id FROM @a));
          DELETE dbo.KetQuaDauGia WHERE phien_dau_gia_id IN(SELECT id FROM @a);
          DELETE dbo.YeuCauDatGia WHERE phien_dau_gia_id IN(SELECT id FROM @a);
          DELETE dbo.LuotDatGia WHERE phien_dau_gia_id IN(SELECT id FROM @a);
          DELETE dbo.LichSuDauGia WHERE phien_dau_gia_id IN(SELECT id FROM @a);
          DELETE dbo.BinhLuan WHERE phien_dau_gia_id IN(SELECT id FROM @a);DELETE dbo.PhienDauGia WHERE phien_dau_gia_id IN(SELECT id FROM @a);
          DELETE dbo.BaiDang WHERE bai_dang_id IN(SELECT id FROM @p);DELETE dbo.Sach WHERE sach_id IN(SELECT id FROM @b);
          DELETE dbo.NguoiDung WHERE nguoi_dung_id IN (${ids});COMMIT TRANSACTION;`);
      }
    };
    for(let i=0;i<4;i++)userIds.push((await pool.request().input('email',sql.VarChar(254),`auction-${runId}-${i}@example.test`)
      .input('role',sql.VarChar(20),i===3?'admin':'nguoi_dung').query("INSERT dbo.NguoiDung(ho_ten,email,mat_khau,vai_tro) OUTPUT inserted.nguoi_dung_id VALUES(N'Fixture đấu giá',@email,'test-only-not-a-real-password',@role)")).recordset[0].nguoi_dung_id);
    const [seller,a,b,admin]=userIds;
    async function fixture({start=-60000,end=3600000,threshold='999999999999999999',price='100000',step='1000',state='da_kich_hoat'}={}) {
      const result=await pool.request().input('seller',sql.Int,seller).input('code',sql.VarChar(40),'T'+randomUUID().replaceAll('-',''))
        .input('state',sql.VarChar(30),state).input('price',sql.VarChar(18),price).input('step',sql.VarChar(18),step).input('threshold',sql.VarChar(18),threshold)
        .input('start',sql.Int,start).input('end',sql.Int,end).query(`SET XACT_ABORT ON;BEGIN TRANSACTION;
          INSERT dbo.Sach(ten_sach,tinh_trang_sach) VALUES(N'Sách fixture đấu giá',N'Dữ liệu kiểm thử');DECLARE @book INT=SCOPE_IDENTITY();
          INSERT dbo.BaiDang(nguoi_dung_id,sach_id,ma_san_pham,tieu_de,mo_ta_tinh_trang,trang_thai) VALUES(@seller,@book,@code,N'Fixture',N'Chỉ kiểm thử','da_duyet');DECLARE @post INT=SCOPE_IDENTITY();
          INSERT dbo.PhienDauGia(bai_dang_id,gia_khoi_diem,gia_toi_thieu,buoc_gia,trang_thai,thoi_gian_bat_dau,thoi_gian_ket_thuc)
          VALUES(@post,CAST(@price AS DECIMAL(18,0)),CAST(@threshold AS DECIMAL(18,0)),CAST(@step AS DECIMAL(18,0)),@state,
          DATEADD(MILLISECOND,@start,SYSUTCDATETIME()),DATEADD(MILLISECOND,@end,SYSUTCDATETIME()));DECLARE @auction INT=SCOPE_IDENTITY();
          COMMIT TRANSACTION;SELECT @auction AS id,@post AS post_id;`);
      return result.recordset[0].id;
    }
    const event=(auctionId,userId=a,amount='100000',requestId=randomUUID())=>({eventId:requestId,eventType:settings.bidType,auctionId,userId,amount,requestId,createdAt:new Date().toISOString()});
    async function retry(work) {
      for(let i=0;;i++)try{return await work();}catch(error){if(i>=5||![1205,2601,2627].includes(error.number)&&error.code!=='AUCTION_WRITE_CONFLICT')throw error;await delay(20*(i+1));}
    }
    async function counts(id) {
      return (await pool.request().input('id',sql.Int,id).query(`SELECT
        (SELECT COUNT(*) FROM dbo.LuotDatGia WHERE phien_dau_gia_id=@id) AS bids,
        (SELECT COUNT(*) FROM dbo.YeuCauDatGia WHERE phien_dau_gia_id=@id) AS decisions,
        (SELECT COUNT(*) FROM dbo.KetQuaDauGia WHERE phien_dau_gia_id=@id) AS results,
        (SELECT COUNT(*) FROM dbo.GiaoDich g JOIN dbo.KetQuaDauGia k ON k.ket_qua_id=g.ket_qua_id WHERE k.phien_dau_gia_id=@id) AS trades`)).recordset[0];
    }
    await t.test('migration chạy lại giữ lượt cũ, backfill quyết định hợp lệ và không đoán lý do lịch sử',async()=>{
      const id=await fixture(),code=randomUUID();
      await pool.request().input('id',sql.Int,id).input('user',sql.Int,a).input('code',sql.VarChar(64),code).query(`INSERT dbo.LuotDatGia(phien_dau_gia_id,nguoi_dung_id,muc_gia,thoi_gian_dat,ma_yeu_cau) VALUES(@id,@user,100000,SYSUTCDATETIME(),@code);UPDATE dbo.PhienDauGia SET gia_hien_tai=100000 WHERE phien_dau_gia_id=@id;`);
      const legacy=await fixture({start:-7200000,end:-3600000,state:'da_ket_thuc'});
      await pool.request().input('id',sql.Int,legacy).query("INSERT dbo.KetQuaDauGia(phien_dau_gia_id,trang_thai,thoi_gian_ket_thuc) VALUES(@id,'khong_co_nguoi_thang',SYSUTCDATETIME())");
      const ddl=await readFile(new URL('../migrations/003_auction_decisions.sql',import.meta.url),'utf8');await pool.request().batch(ddl);await pool.request().batch(ddl);
      assert.equal((await model.findRequest(code)).trang_thai,'da_chap_nhan');assert.equal((await counts(id)).bids,1);assert.equal((await counts(id)).decisions,1);
      assert.equal((await model.publicAuction(legacy)).ket_qua.ly_do_ket_thuc,null);
      const signature=(await pool.request().query("SELECT (SELECT COUNT(*) FROM sys.tables WHERE schema_id=SCHEMA_ID('dbo')) AS tables,(SELECT COUNT(*) FROM sys.columns c JOIN sys.tables t ON t.object_id=c.object_id WHERE t.schema_id=SCHEMA_ID('dbo')) AS columns")).recordset[0];
      assert.deepEqual(signature,{tables:20,columns:152});
    });
    await t.test('hai yêu cầu cùng giá không cùng được ghi; cùng mã xử lý đồng thời chỉ tạo một lượt',async()=>{
      const id=await fixture(),inputs=[event(id,a),event(id,b)];
      const results=await Promise.all(inputs.map(input=>retry(()=>model.processBid(input))));
      assert.deepEqual(results.map(x=>x.trang_thai).sort(),['bi_tu_choi','da_chap_nhan']);assert.equal(results.find(x=>x.trang_thai==='bi_tu_choi').ly_do,'BID_TOO_LOW');
      assert.deepEqual(await counts(id),{bids:1,decisions:2,results:0,trades:0});
      const other=await fixture(),same=event(other);
      const repeated=await Promise.all([retry(()=>model.processBid(same)),retry(()=>model.processBid(same))]);
      assert(repeated.every(x=>x.trang_thai==='da_chap_nhan'));assert.equal((await counts(other)).bids,1);
      await assert.rejects(model.processBid({...same,amount:'101000'}),{code:'REQUEST_ID_CONFLICT'});
    });
    await t.test('từ chối được lưu bền vững: phiên bắt đầu sau đó không biến retry cũ thành chấp nhận',async()=>{
      const id=await fixture({start:60000,end:3600000}),input=event(id);
      assert.equal((await model.processBid(input)).ly_do,'AUCTION_NOT_STARTED');
      await pool.request().input('id',sql.Int,id).query('UPDATE dbo.PhienDauGia SET thoi_gian_bat_dau=DATEADD(MINUTE,-1,SYSUTCDATETIME()) WHERE phien_dau_gia_id=@id');
      assert.equal((await model.processBid(input)).ly_do,'AUCTION_NOT_STARTED');
      assert.equal((await model.processBid(event(id))).trang_thai,'da_chap_nhan');assert.equal((await counts(id)).bids,1);
    });
    await t.test('SQL kiểm tra chủ sách, vai trò mới nhất, bước giá và cooldown của cùng người',async()=>{
      const id=await fixture();
      assert.equal((await model.bidStatus(id,seller)).la_chu_sach,true);
      assert.equal((await model.bidStatus(id,a)).duoc_dat_lai_luc,null);
      assert.equal((await model.processBid(event(id,seller))).ly_do,'SELLER_CANNOT_BID');
      assert.equal((await model.processBid(event(id,admin))).ly_do,'BIDDER_NOT_ALLOWED');
      assert.equal((await model.processBid(event(id,a,'100001'))).ly_do,'INVALID_BID_STEP');
      const accepted=await model.processBid(event(id));assert.equal(accepted.trang_thai,'da_chap_nhan');
      const personal=await model.bidStatus(id,a);
      assert.equal(personal.la_chu_sach,false);
      assert.equal(personal.duoc_dat_lai_luc.getTime()-accepted.thoi_gian_xu_ly.getTime(),20000);
      assert.equal((await model.bidStatus(id,b)).duoc_dat_lai_luc,null);
      assert.equal((await model.processBid(event(id,a,'101000'))).ly_do,'BID_COOLDOWN');
      assert.equal((await model.processBid(event(id,b,'101000'))).trang_thai,'da_chap_nhan');
      assert.equal((await counts(id)).bids,2);
    });
    await t.test('18 chữ số đi qua driver/DECIMAL nguyên vẹn; kết thúc sớm tạo đúng một kết quả/giao dịch',async()=>{
      const id=await fixture({price:'999999999999999991',step:'2'}),input=event(id,a,'999999999999999999');
      assert.equal((await model.processBid(input)).muc_gia,'999999999999999999');
      const snapshot=await model.publicAuction(id);assert.equal(snapshot.trang_thai,'da_ket_thuc');assert.equal(snapshot.ket_qua.muc_gia_thang,'999999999999999999');assert.equal(snapshot.ket_qua.ly_do_ket_thuc,'dat_gia_toi_thieu');assert(!('gia_toi_thieu' in snapshot));
      assert.equal(snapshot.lich_su[0].muc_gia,snapshot.ket_qua.muc_gia_thang);
      assert.deepEqual((await model.publicHistory(id)).items,snapshot.lich_su);
      await model.processBid(input);await Promise.all([retry(()=>model.closeExpired(id)),retry(()=>model.closeExpired(id))]);
      assert.deepEqual(await counts(id),{bids:1,decisions:1,results:1,trades:1});
      const amount=(await pool.request().input('id',sql.Int,id).query('SELECT CONVERT(VARCHAR(18),g.so_tien) AS amount FROM dbo.GiaoDich g JOIN dbo.KetQuaDauGia k ON g.ket_qua_id=k.ket_qua_id WHERE k.phien_dau_gia_id=@id')).recordset[0].amount;assert.equal(amount,'999999999999999999');
      const equal=await fixture({threshold:'100000'});await model.processBid(event(equal));assert.equal((await model.publicAuction(equal)).ket_qua.ly_do_ket_thuc,'dat_gia_toi_thieu');
      const over=await fixture({threshold:'100500'});await model.processBid(event(over,a,'101000'));assert.equal((await model.publicAuction(over)).ket_qua.muc_gia_thang,'101000');
    });
    await t.test('hết hạn: không người thắng không tạo giao dịch; có giá thấp hơn ngưỡng vẫn thắng; bid muộn bị chặn',async()=>{
      const empty=await fixture({start:-7200000,end:-1000});await Promise.all([retry(()=>model.closeExpired(empty)),retry(()=>model.closeExpired(empty))]);
      assert.deepEqual(await counts(empty),{bids:0,decisions:0,results:1,trades:0});
      const id=await fixture();await model.processBid(event(id));
      await pool.request().input('id',sql.Int,id).query('UPDATE dbo.PhienDauGia SET thoi_gian_bat_dau=DATEADD(HOUR,-2,SYSUTCDATETIME()),thoi_gian_ket_thuc=DATEADD(SECOND,-1,SYSUTCDATETIME()) WHERE phien_dau_gia_id=@id');
      assert.equal((await model.processBid(event(id,b,'101000'))).ly_do,'AUCTION_EXPIRED');
      const result=(await model.publicAuction(id)).ket_qua;assert.equal(result.nguoi_thang_dau_id,a);assert.equal(result.muc_gia_thang,'100000');assert.equal(result.ly_do_ket_thuc,'het_thoi_gian');
      assert.deepEqual(await counts(id),{bids:1,decisions:2,results:1,trades:1});
    });
    await t.test('lỗi trước COMMIT rollback cả quyết định, giá, kết quả và giao dịch; retry cùng mã ghi đúng một lần',async()=>{
      const id=await fixture({threshold:'100000'}),input=event(id);
      await assert.rejects(model.processBid(input,{beforeCommit:async()=>{throw Error('simulated failure before COMMIT');}}),/before COMMIT/);
      assert.deepEqual(await counts(id),{bids:0,decisions:0,results:0,trades:0});
      const snapshot=await model.publicAuction(id);assert.equal(snapshot.trang_thai,'da_kich_hoat');assert.equal(snapshot.gia_hien_tai,null);
      assert.equal((await model.processBid(input)).trang_thai,'da_chap_nhan');assert.deepEqual(await counts(id),{bids:1,decisions:1,results:1,trades:1});
    });
    await t.test('lease hết hạn trong transaction: chủ cũ rollback, worker mới ghi đúng một lượt',async()=>{
      const id=await fixture(),lockPrefix=prefix+'lease:';
      const locks=createAuctionLock({getRedis:()=>redis,keyPrefix:lockPrefix,leaseMs:300});
      let ready,release;const atCommit=new Promise(resolve=>{ready=resolve;}),gate=new Promise(resolve=>{release=resolve;});
      const firstModel={processBid:(input,{beforeCommit})=>model.processBid(input,{beforeCommit:async()=>{ready();await gate;await beforeCommit();}})};
      const old=createAuctionProcessor({model:firstModel,locks,leaseMs:30000,settings});
      const first=old(event(id)).then(()=>({ok:true}),error=>({error}));await atCommit;await delay(350);
      let acquired;const gotLease=new Promise(resolve=>{acquired=resolve;});
      const observedLocks={acquire:async key=>{const lease=await locks.acquire(key);assert(lease);acquired();return lease;}};
      const worker=createAuctionProcessor({model,locks:observedLocks,leaseMs:300,settings});
      const second=worker(event(id,b));await gotLease;release();
      assert((await first).error);assert.equal((await second).trang_thai,'da_chap_nhan');assert.deepEqual(await counts(id),{bids:1,decisions:1,results:0,trades:0});
    });
    await t.test('COMMIT xong trước ACK: XAUTOCLAIM nhận lại và đọc quyết định, không thêm lượt/lịch sử',async()=>{
      await ensureAuctionGroup(redis,settings);const id=await fixture(),input=event(id);
      await publisher.bid(input);const messages=await redis.xReadGroup(settings.group,'worker-before-crash',{key:settings.stream,id:'>'},{COUNT:1});
      const handle=createAuctionProcessor({model,locks:createAuctionLock({getRedis:()=>redis,keyPrefix:prefix+'lock:'}),settings});
      await processAuctionMessage({client:redis,message:messages[0].messages[0],handle,settings,beforeAck:async()=>{throw Error('simulated crash after COMMIT');}});
      assert.equal((await counts(id)).bids,1);assert.equal((await redis.xPending(settings.stream,settings.group)).pending,1);
      const reclaimed=await redis.xAutoClaim(settings.stream,settings.group,'replacement',0,'0-0',{COUNT:10});assert.equal(reclaimed.messages.length,1);
      await processAuctionMessage({client:redis,message:reclaimed.messages[0],handle,settings});
      assert.equal((await redis.xPending(settings.stream,settings.group)).pending,0);assert.equal(await redis.xLen(settings.stream),0);assert.equal((await counts(id)).bids,1);
      assert.equal((await pool.request().input('id',sql.Int,id).query('SELECT COUNT(*) AS n FROM dbo.LichSuDauGia WHERE phien_dau_gia_id=@id')).recordset[0].n,1);
    });
    await t.test('job chốt hạn xếp lại an toàn, nhiều thông điệp kết thúc chỉ tạo một kết quả',async()=>{
      const id=await fixture({start:-7200000,end:-1000});await scanExpired({model,publisher});await scanExpired({model,publisher});
      const streams=await redis.xReadGroup(settings.group,'expiry',{key:settings.stream,id:'>'},{COUNT:100});
      const handle=createAuctionProcessor({model,locks:createAuctionLock({getRedis:()=>redis,keyPrefix:prefix+'lock:'}),settings});
      for(const stream of streams||[])for(const message of stream.messages)await processAuctionMessage({client:redis,message,handle,settings});
      assert.deepEqual(await counts(id),{bids:0,decisions:0,results:1,trades:0});
    });
  });
