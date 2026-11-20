/** Automatic moderation decides from validated scores and never turns an outage into rejection. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {moderationDecision} from '../src/ai/moderation.js';
import {parseAiConfig} from '../src/config/ai.js';
import {createAiProcessor} from '../src/ai/processor.js';
import {enqueueAutoReviews} from '../src/ai/scheduler.js';
import {inputHash} from '../src/ai/input.js';
import {createPostService} from '../src/services/post.service.js';
import {createAiService} from '../src/services/ai.service.js';
import {CRITERIA} from '../src/ai/criteria.js';
const thresholds={rarity:70,condition:75};
const scored={trang_thai:'thanh_cong',diem_do_hiem:70,diem_tinh_trang:75,chi_tiet:[]};
test('high and low AI scores stay advisory; late AI cannot replace an Admin decision',async()=>{
  for(const high of [true,false]) {
    const row={row_version:'0000000000000001',trang_thai_phien:'cho_kiem_duyet'};
    let receipt,decisionCalls=0;
    const observations={criteria:CRITERIA.map(c=>({id:c.id,status:'assessed',findings:[c.group==='do_hiem'?(high?'meets':'not_meets'):(high?'intact':'severe')],evidence:'M1: bằng chứng thử nghiệm.',media_refs:['M1'],sources:[]}))};
    const run=createAiProcessor({posts:{detail:async()=>row},model:{find:async()=>null,save:async(job,result,metadata,check,...extra)=>{
      await check();assert.equal(extra.length,0);receipt={result,metadata};return {phan_tich_id:1};
    },recordAutoReview:()=>decisionCalls++},queue:{get:async()=>null,update:async(j,p)=>({...j,...p})},
      provider:{analyze:async()=>({observations,mediaIds:['M1'],sourceUrls:[],manifest:[],warnings:[]})},
      locks:{acquire:async()=>({renew:async()=>true,release:async()=>{}})},config:{autoAnalysis:true,configured:true,reviewThresholds:thresholds,jobTimeout:1000}});
    await run({postId:1,requestId:randomUUID(),trigger:'auto',sourceVersion:row.row_version,inputHash:inputHash(row)});
    assert.equal(row.trang_thai_phien,'cho_kiem_duyet');assert.equal(decisionCalls,0);
    assert.equal(receipt.metadata.recommendation.approve,high);
    row.trang_thai_phien='da_qua_kiem_duyet';receipt=null;
    await run({postId:1,requestId:randomUUID(),trigger:'auto',sourceVersion:row.row_version,inputHash:inputHash(row)});
    assert.equal(receipt,null);assert.equal(row.trang_thai_phien,'da_qua_kiem_duyet');
  }
});
test('both thresholds inclusive; one below is rejected with actual observations',()=>{
  assert.equal(moderationDecision(scored,{},thresholds).approve,true);
  const low={...scored,diem_tinh_trang:74.99,chi_tiet:[{nhom_tieu_chi:'tinh_trang',tieu_chi:'Gáy',trang_thai_danh_gia:'Đã đánh giá',diem:50,bang_chung:'Gáy bung ở góc.'}]};
  const decision=moderationDecision(low,{},thresholds);
  assert.equal(decision.approve,false);assert.match(decision.reason,/Tình trạng vật lý: 74,99\/100/);assert.match(decision.reason,/Gáy bung ở góc/);assert.doesNotMatch(decision.reason,/độ hiếm.*dưới/);
});
test('NULL needs evidence, while provider/media outage stays pending',()=>{
  const partial={...scored,trang_thai:'chua_day_du',diem_do_hiem:null,chi_tiet:[{nhom_tieu_chi:'do_hiem',tieu_chi:'Ấn bản giới hạn',trang_thai_danh_gia:'Chưa đủ dữ liệu',bang_chung:'Chưa thấy trang bản quyền.'}]};
  const verdict=moderationDecision(partial,{},thresholds);
  assert.equal(verdict.approve,false);assert.match(verdict.reason,/Chưa thấy trang bản quyền/);assert.doesNotMatch(verdict.reason,/độ hiếm: 0\/100/);
  assert.equal(moderationDecision(partial,{media:[{sent:false,reason:'video_timeout'}]},thresholds),null);
  assert.equal(moderationDecision({...partial,trang_thai:'that_bai'}, {}, thresholds),null);
});
test('separate missing photos and unverified provenance into concrete steps for the seller',()=>{
  const partial={...scored,trang_thai:'chua_day_du',diem_do_hiem:null,diem_tinh_trang:null,chi_tiet:[
    {nhom_tieu_chi:'do_hiem',tieu_chi:'Lai lịch và dấu ấn riêng',trang_thai_danh_gia:'Cần xác minh',
      bang_chung:'M2 đọc được nhãn sở hữu.',canh_bao:'Admin cần xác minh thủ công.'},
    {nhom_tieu_chi:'tinh_trang',tieu_chi:'Mép giấy',trang_thai_danh_gia:'Chưa đủ dữ liệu'},
    {nhom_tieu_chi:'tinh_trang',tieu_chi:'Bìa áo',trang_thai_danh_gia:'Không áp dụng'},
  ]};
  const verdict=moderationDecision(partial,{},thresholds);
  assert.equal(verdict.approve,false);
  assert.match(verdict.reason,/Cần xác minh\. Quan sát: M2 đọc được nhãn sở hữu/);
  assert.match(verdict.reason,/mã lưu trữ/);
  assert.match(verdict.reason,/mép trên, mép dưới và mép ngoài/);
  assert.doesNotMatch(verdict.reason,/Admin|Bìa áo|Mức đạt/);
});
test('thresholds stay advisory and automatic analysis can be disabled for isolated smoke',()=>{
  assert.deepEqual(parseAiConfig({AI_AUTO_MODERATION:'false',AI_MIN_RARITY_SCORE:'',AI_MIN_CONDITION_SCORE:''}).reviewThresholds,{rarity:70,condition:70});
  assert.throws(()=>parseAiConfig({AI_MIN_CONDITION_SCORE:'101'}),/AI_MIN_CONDITION_SCORE/);
  assert.deepEqual(parseAiConfig({AI_MIN_RARITY_SCORE:'70',AI_MIN_CONDITION_SCORE:'75'}).reviewThresholds,thresholds);
  assert.throws(()=>parseAiConfig({AI_TEST_MANUAL_REVIEW:'true',DB_DATABASE:'BookAuctionDB'}),/BookAuctionTest_/);
  assert.throws(()=>parseAiConfig({AI_TEST_MANUAL_REVIEW:'true',NODE_ENV:'production',DB_DATABASE:'BookAuctionTest_Smoke'}),/development/);
  assert.equal(parseAiConfig({AI_TEST_MANUAL_REVIEW:'true',DB_DATABASE:'BookAuctionTest_Smoke'}).autoAnalysis,false);
});
test('submission enqueues after commit, never on replay, and keeps SQL success if Redis is down',async()=>{
  let committed=false,found=null;const sent=[],logged=[];
  const row={bai_dang_id:7,row_version:'0000000000000001',trang_thai_phien:'cho_kiem_duyet'};
  const ai=createAiService({config:{configured:true,autoAnalysis:true,reviewThresholds:thresholds},posts:{detail:async id=>{assert(committed);return {...row,bai_dang_id:id};}},queue:{enqueue:async (source,trigger)=>{sent.push([source.bai_dang_id,trigger]);if(source.bai_dang_id===8)throw Error('Redis down');}}});
  const posts=createPostService({autoAnalysis:true,reviewThresholds:thresholds,model:{findRequest:async()=>found,create:async()=>{committed=true;return {id:7};},resubmit:async()=>{committed=true;return {id:8};}},ledger:{claim:async()=>({items:[]}),bound:async()=>{}},enqueueReview:ai.enqueueSubmission,log:e=>logged.push(e.message)});
  const input={requestId:randomUUID(),media:[]};
  assert.deepEqual(await posts.create(1,input),{id:7});
  found=7;assert.deepEqual(await posts.create(1,input),{id:7,replayed:true});
  committed=false;assert.deepEqual(await posts.resubmit(1,8,input),{id:8});
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(sent,[[7,'auto'],[8,'auto']]);assert.deepEqual(logged,['Redis down']);
});
test('Admin can decide even if Gemini is disabled, unavailable, or suggests rejection',async()=>{
  for (const configured of [false,true]) {
    let saved;
    const posts=createPostService({autoAnalysis:true,model:{review:async args=>(saved=args,{id:1})}});
    const input={decision:'phe_duyet',reason:'Admin đã đối chiếu bằng chứng',rowVersion:'v1'};
    assert.deepEqual(await posts.review(2,1,input),{id:1});
    assert.deepEqual(saved,{admin:2,postId:1,input});
  }
});
test('scheduler only recovers unanalysed rounds, even if a result is saved after the SQL scan',async()=>{
  const rows=[1,2,3,4,5,6].map(bai_dang_id=>({bai_dang_id,row_version:'v1',trang_thai_phien:'cho_kiem_duyet'}));
  const sent=[];await enqueueAutoReviews({signal:new AbortController().signal,model:{autoCandidates:async()=>rows},posts:{detail:async id=>({...rows[id-1],row_version:id===3?'v2':'v1',trang_thai_phien:id===4?'da_qua_kiem_duyet':'cho_kiem_duyet',
    ai:id>=5?{phan_tich_id:id,thong_tin:{source_version:id===5?'v1':'previous'}}:null})},queue:{status:async id=>id===2?{trigger:'auto',source_version:'v1',state:'running'}:null,enqueue:async (row,trigger)=>sent.push([row.bai_dang_id,trigger])}});
  assert.deepEqual(sent,[[1,'auto'],[6,'auto']]);
});
test('after a timeout only an explicit retry can make another Gemini request for this round',async()=>{
  const row={bai_dang_id:1,row_version:'0000000000000001',trang_thai_phien:'cho_kiem_duyet'};
  const job=(retryOf)=>({postId:1,sourceVersion:row.row_version,inputHash:inputHash(row),trigger:'auto',requestId:randomUUID(),...(retryOf?{retryOf}:{})});
  let calls=0,writes=0,stage;
  const run=createAiProcessor({posts:{detail:async()=>row},model:{find:async()=>null,save:async(j,result,info,check,verdict)=>{
    await check();assert.equal(verdict,undefined);assert.equal(info.error_code,'AI_TIMEOUT');
    return row.ai={...result,phan_tich_id:++writes,thong_tin:info};
  }},queue:{get:async()=>null,update:async(j,p)=>{stage=p.state;return {...j,...p};}},
  provider:{analyze:async()=>{calls++;throw Object.assign(Error('timeout'),{code:'AI_TIMEOUT'});}},
  locks:{acquire:async()=>({renew:async()=>true,release:async()=>{}})},config:{configured:true,autoAnalysis:true,reviewThresholds:thresholds,jobTimeout:1000}});
  await run(job());assert.equal(stage,'done');
  await run(job());assert.equal(stage,'skipped');assert.equal(calls,1);
  await run(job(1));assert.equal(stage,'done');assert.equal(calls,2);
  await run(job(1));assert.equal(stage,'skipped');assert.equal(calls,2);
  row.row_version='0000000000000002';
  await run(job(2));assert.equal(stage,'skipped');
  await run(job());assert.equal(stage,'done');assert.equal(calls,3);
});
test('auto processor persists only advisory scores for the exact input; replay and stale job do not call Gemini',async()=>{
  const row={bai_dang_id:1,row_version:'0000000000000001',trang_thai_phien:'cho_kiem_duyet'};
  const job={postId:1,sourceVersion:row.row_version,inputHash:inputHash(row),trigger:'auto',requestId:randomUUID()};
  let saved=null,calls=0,cache=null,verdict;
  const run=createAiProcessor({posts:{detail:async()=>row},model:{find:async j=>j.requestId===job.requestId?saved:null,save:async(j,result,metadata,check,value)=>{await check();assert.equal(metadata.recommendation.approve,false);assert.equal(result.diem_do_hiem,null);verdict=value;return saved={phan_tich_id:1};}},queue:{get:async()=>cache,update:async(j,p)=>{cache={...j,...p};return cache;}},provider:{analyze:async()=>{calls++;return {observations:{criteria:[]},mediaIds:[],manifest:[],warnings:[]};}},locks:{acquire:async()=>({renew:async()=>true,release:async()=>{}})},config:{configured:true,autoAnalysis:true,reviewThresholds:thresholds,jobTimeout:1000}});
  await run(job);await run(job);await run({...job,requestId:randomUUID(),inputHash:'stale'});
  assert.equal(calls,1);assert.equal(verdict,undefined);assert.equal(cache.state,'skipped');
});
