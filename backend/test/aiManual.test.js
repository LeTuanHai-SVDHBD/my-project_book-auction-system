/** AI must be explicitly requested; saved listing operations and status reads do not enqueue work. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createPostService} from '../src/services/post.service.js';
import {createAiService} from '../src/services/ai.service.js';

test('create, relist, resubmit and replay save posts without AI; Admin can request a job afterwards',async()=>{
 let creates=0,resubmits=0,claims=0,bound=0,enqueued=0,exists=null;
 const row={bai_dang_id:7,row_version:'0000000000000001',trang_thai_phien:'cho_kiem_duyet',ai:null};
 const model={findRequest:async()=>exists,create:async()=>{creates++;return {id:7};},resubmit:async()=>{resubmits++;return {id:7};},detail:async()=>row};
 const posts=createPostService({model,ledger:{claim:async()=>{claims++;return {items:[]};},bound:async()=>bound++},enqueueAi:()=>assert.fail('Listing save must not enqueue AI')});
 const input={requestId:'32c0150b-d82b-41bf-87ca-45998cdebe06',media:[]};
 assert.deepEqual(await posts.create(1,input),{id:7});assert.equal(enqueued,0);
 await posts.create(1,input,5);await posts.resubmit(1,7,input);exists=7;
 assert.deepEqual(await posts.create(1,input),{id:7,replayed:true});assert.equal(creates,2);assert.equal(resubmits,1);assert.equal(claims,3);assert.equal(bound,3);
 const ai=createAiService({posts:model,model:{history:async()=>[]},config:{configured:true},queue:{status:async()=>null,enqueue:async r=>{enqueued++;assert.equal(r,row);return {state:'queued',requestId:'fixture'};}}});
 for(let i=0;i<3;i++){const state=await ai.status(7,{vai_tro:'admin'});assert.equal(state.analysis,null);assert.equal(state.job,null);}
 assert.equal(enqueued,0);await ai.request(7,{vai_tro:'admin'},row.row_version);assert.equal(enqueued,1);
});

test('status ignores legacy automatic jobs while retaining prior SQL analysis/history; current manual progress stays visible',async()=>{
 const analysis={phan_tich_id:3,trang_thai:'that_bai',diem_do_hiem:null,diem_tinh_trang:null,thong_tin:{error_code:'AI_PROVIDER_UNAVAILABLE'}};
 const row={row_version:'0000000000000001',trang_thai_phien:'cho_kiem_duyet',ai:analysis};
 let job={trigger:'auto',source_version:row.row_version,state:'queued',analysis_id:99};
 const service=createAiService({posts:{detail:async()=>row},model:{history:async()=>[{phan_tich_id:3}],get:()=>assert.fail('An old auto job cannot select a result')},config:{configured:true},queue:{status:async()=>job}});
 const previous=await service.status(7,{vai_tro:'admin'});assert.equal(previous.job,null);assert.equal(previous.analysis,analysis);assert.equal(previous.history[0].phan_tich_id,3);
 job={...job,trigger:'manual',analysis_id:null};const active=await service.status(7,{vai_tro:'admin'});assert.equal(active.job.state,'queued');
 job={...job,source_version:'0000000000000002'};assert.equal((await service.status(7,{vai_tro:'admin'})).job,null);
});
