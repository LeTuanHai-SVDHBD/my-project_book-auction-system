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
const thresholds={rarity:70,condition:75};
const scored={trang_thai:'thanh_cong',diem_do_hiem:70,diem_tinh_trang:75,chi_tiet:[]};
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
test('legacy false does not disable automatic moderation; only isolated smoke can exercise manual decisions',()=>{
  assert.deepEqual(parseAiConfig({AI_AUTO_MODERATION:'false',AI_MIN_RARITY_SCORE:'',AI_MIN_CONDITION_SCORE:''}).autoModeration,{rarity:70,condition:70});
  assert.throws(()=>parseAiConfig({AI_MIN_CONDITION_SCORE:'101'}),/AI_MIN_CONDITION_SCORE/);
  assert.deepEqual(parseAiConfig({AI_MIN_RARITY_SCORE:'70',AI_MIN_CONDITION_SCORE:'75'}).autoModeration,thresholds);
  assert.throws(()=>parseAiConfig({AI_TEST_MANUAL_REVIEW:'true',DB_DATABASE:'BookAuctionDB'}),/BookAuctionTest_/);
  assert.throws(()=>parseAiConfig({AI_TEST_MANUAL_REVIEW:'true',NODE_ENV:'production',DB_DATABASE:'BookAuctionTest_Smoke'}),/development/);
  assert.equal(parseAiConfig({AI_TEST_MANUAL_REVIEW:'true',DB_DATABASE:'BookAuctionTest_Smoke'}).autoModeration,null);
});
test('submission enqueues after commit, never on replay, and keeps SQL success if Redis is down',async()=>{
  let committed=false,found=null;const sent=[],logged=[];
  const row={bai_dang_id:7,row_version:'0000000000000001',trang_thai_phien:'cho_kiem_duyet'};
  const ai=createAiService({config:{configured:true,autoModeration:thresholds},posts:{detail:async id=>{assert(committed);return {...row,bai_dang_id:id};}},queue:{enqueue:async (source,trigger)=>{sent.push([source.bai_dang_id,trigger]);if(source.bai_dang_id===8)throw Error('Redis down');}}});
  const posts=createPostService({autoModeration:thresholds,model:{findRequest:async()=>found,create:async()=>{committed=true;return {id:7};},resubmit:async()=>{committed=true;return {id:8};}},ledger:{claim:async()=>({items:[]}),bound:async()=>{}},enqueueReview:ai.enqueueSubmission,log:e=>logged.push(e.message)});
  const input={requestId:randomUUID(),media:[]};
  assert.deepEqual(await posts.create(1,input),{id:7});
  found=7;assert.deepEqual(await posts.create(1,input),{id:7,replayed:true});
  committed=false;assert.deepEqual(await posts.resubmit(1,8,input),{id:8});
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(sent,[[7,'auto'],[8,'auto']]);assert.deepEqual(logged,['Redis down']);
});
test('automatic mode keeps the Admin decision endpoint blocked even if Gemini is disabled',async()=>{
  const posts=createPostService({autoModeration:parseAiConfig({AI_ENABLED:'false'}).autoModeration,model:{review:()=>assert.fail('manual review')}});
  await assert.rejects(posts.review(2,1,{}),{code:'AUTO_MODERATION_ENABLED'});
});
test('scheduler deduplicates active versions and does not enqueue a changed round',async()=>{
  const rows=[1,2,3,4].map(bai_dang_id=>({bai_dang_id,row_version:'v1',trang_thai_phien:'cho_kiem_duyet'}));
  const sent=[];await enqueueAutoReviews({signal:new AbortController().signal,model:{autoCandidates:async()=>rows},posts:{detail:async id=>({...rows[id-1],row_version:id===3?'v2':'v1',trang_thai_phien:id===4?'da_qua_kiem_duyet':'cho_kiem_duyet'})},queue:{status:async id=>id===2?{trigger:'auto',source_version:'v1',state:'running'}:null,enqueue:async (row,trigger)=>sent.push([row.bai_dang_id,trigger])}});
  assert.deepEqual(sent,[[1,'auto']]);
});
test('auto processor sends one persisted verdict for the exact input; replay and stale job do not call Gemini',async()=>{
  const row={bai_dang_id:1,row_version:'0000000000000001',trang_thai_phien:'cho_kiem_duyet'};
  const job={postId:1,sourceVersion:row.row_version,inputHash:inputHash(row),trigger:'auto',requestId:randomUUID()};
  let saved=null,calls=0,cache=null,verdict;
  const run=createAiProcessor({posts:{detail:async()=>row},model:{find:async j=>j.requestId===job.requestId?saved:null,save:async(j,result,metadata,check,value)=>{await check();assert.equal(metadata.moderation.decision,'rejected');assert.equal(result.diem_do_hiem,null);verdict=value;return saved={phan_tich_id:1};}},queue:{get:async()=>cache,update:async(j,p)=>{cache={...j,...p};return cache;}},provider:{analyze:async()=>{calls++;return {observations:{criteria:[]},mediaIds:[],manifest:[],warnings:[]};}},locks:{acquire:async()=>({renew:async()=>true,release:async()=>{}})},config:{configured:true,autoModeration:thresholds,jobTimeout:1000}});
  await run(job);await run(job);await run({...job,requestId:randomUUID(),inputHash:'stale'});
  assert.equal(calls,1);assert.equal(verdict.approve,false);assert.match(verdict.reason,/chưa đủ bằng chứng/);assert.equal(cache.state,'skipped');
});
