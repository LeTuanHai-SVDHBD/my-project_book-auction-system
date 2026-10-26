/** Kiểm tra replay/cached result, lỗi AI và stale input độc lập với nhà cung cấp/SQL thật. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createAiProcessor} from '../src/ai/processor.js';
import {createAiService} from '../src/services/ai.service.js';
import {analysisView} from '../src/ai/input.js';
import {META_CRITERION} from '../src/ai/criteria.js';
const job=()=>({postId:1,requestId:randomUUID(),sourceVersion:'0000000000000001',inputHash:'a'.repeat(64),state:'queued'});
function fixture(){
  let cached=null,receipt=null,output=null,calls=0,writes=0;const row={row_version:'0000000000000001',trang_thai_phien:'cho_kiem_duyet'};
  const queue={get:async()=>cached,update:async(j,patch)=>(cached={...j,...patch})};
  const model={find:async()=>receipt,save:async(j,result,metadata,check)=>{await check();writes++;output={result,metadata};receipt={phan_tich_id:10};return receipt;}};
  const provider={analyze:async()=>{calls++;return {observations:{criteria:[],warnings:[]},mediaIds:[],sourceUrls:[],warnings:[],manifest:[],providerModel:'fixture'};}};
  const options={posts:{detail:async()=>row},model,provider,queue,locks:{acquire:async()=>({renew:async()=>true,release:async()=>{}})},config:{configured:true,model:'fixture',jobTimeout:1000}};
  return {options,row,queue,model,provider,cached:()=>cached,output:()=>output,calls:()=>calls,writes:()=>writes};
}
test('lưu NULL khi thiếu dữ liệu; replay sau COMMIT không gọi Gemini và không thêm bản ghi',async()=>{
  const f=fixture(),input=job(),handle=createAiProcessor(f.options);await handle(input);assert.equal(f.output().result.diem_do_hiem,null);assert.equal(f.output().result.diem_tinh_trang,null);assert.equal(f.cached().state,'done');
  await handle(input);assert.equal(f.calls(),1);assert.equal(f.writes(),1);
});
test('SQL lỗi sau nhận kết quả: retry dùng cache, không gọi provider lần nữa',async()=>{
  const f=fixture(),save=f.model.save;let fail=true;
  f.model.save=async(...args)=>{if(fail)throw Error('SQL unavailable');return save(...args);};
  const handle=createAiProcessor(f.options),input=job();await assert.rejects(handle(input),/SQL unavailable/);fail=false;await handle(input);assert.equal(f.calls(),1);assert.equal(f.writes(),1);
});
test('lỗi Gemini lưu thất bại với hai điểm NULL; dữ liệu đã thay đổi không lưu nhầm',async()=>{
  const f=fixture();f.provider.analyze=async()=>{throw Object.assign(Error('provider refused'),{code:'AI_QUOTA_EXCEEDED',aiDiagnostics:{http_status:429,provider_code:'QUOTA_EXCEEDED',body:'private-provider-body'}});};await createAiProcessor(f.options)(job());
  assert.equal(f.output().result.trang_thai,'that_bai');assert.equal(f.output().result.diem_do_hiem,null);assert.equal(f.output().metadata.error_code,'AI_QUOTA_EXCEEDED');assert.deepEqual(f.output().metadata.provider_error,{http_status:429,provider_code:'QUOTA_EXCEEDED'});assert(!JSON.stringify(f.output()).includes('private-provider-body'));
  assert.equal(analysisView({...f.output().result,chi_tiet:[{tieu_chi:META_CRITERION,bang_chung:JSON.stringify(f.output().metadata)}]},f.row).tinh_diem,null);
  const stale=fixture();stale.row.row_version='0000000000000002';await createAiProcessor(stale.options)(job());assert.equal(stale.calls(),0);assert.equal(stale.writes(),0);assert.equal(stale.cached().state,'skipped');
});
test('tắt AI không enqueue hoặc sinh phân tích giả; Redis lỗi không chặn đọc SQL đã có',async()=>{
  const service=createAiService({posts:{detail:async()=>({row_version:'0000000000000001',ai:null})},model:{history:async()=>[]},queue:{enqueue:()=>assert.fail(),status:async()=>{throw Error('Redis down');}},config:{configured:false}});
  assert.equal(await service.enqueue(1),null);await assert.rejects(service.request(1,{vai_tro:'admin'},'0000000000000001'),{status:503});
  assert.equal((await service.status(1,{vai_tro:'admin'})).analysis,null);
});
test('job tự động trùng phiên bản dùng kết quả đã lưu, Admin yêu cầu mới vẫn được phân tích lại',async()=>{
  const f=fixture();f.model.forVersion=async()=>({phan_tich_id:9});const handle=createAiProcessor(f.options);
  await handle({...job(),trigger:'auto'});assert.equal(f.calls(),0);assert.equal(f.writes(),0);
  await handle({...job(),trigger:'manual'});assert.equal(f.calls(),1);assert.equal(f.writes(),1);
});
