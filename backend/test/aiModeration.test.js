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
test('requires two explicit thresholds, with no default verdict policy',()=>{
  assert.equal(parseAiConfig({}).autoModeration,null);
  assert.throws(()=>parseAiConfig({AI_AUTO_MODERATION:'true'}),/AI_MIN_RARITY_SCORE/);
  assert.throws(()=>parseAiConfig({AI_AUTO_MODERATION:'true',AI_MIN_RARITY_SCORE:'70',AI_MIN_CONDITION_SCORE:'101'}),/AI_MIN_CONDITION_SCORE/);
  assert.deepEqual(parseAiConfig({AI_AUTO_MODERATION:'true',AI_MIN_RARITY_SCORE:'70',AI_MIN_CONDITION_SCORE:'75'}).autoModeration,thresholds);
});
test('automatic mode rejects both Admin write endpoints at service boundary',async()=>{
  const posts=createPostService({autoModeration:thresholds,model:{review:()=>assert.fail('manual review')}});
  await assert.rejects(posts.review(2,1,{}),{code:'AUTO_MODERATION_ENABLED'});
  const ai=createAiService({config:{autoModeration:thresholds},queue:{enqueue:()=>assert.fail('manual request')}});
  await assert.rejects(ai.request(1,{vai_tro:'admin'},'fixture'),{code:'AUTO_MODERATION_ENABLED'});
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
