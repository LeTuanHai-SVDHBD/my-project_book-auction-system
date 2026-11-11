import test from 'node:test';
import assert from 'node:assert/strict';
import {analysisWorkload,averageAnalysisTime} from '../src/ai/timing.js';
import {createAiService} from '../src/services/ai.service.js';

test('average uses measured successful comparable runs, never timeout; insufficient samples stay null',()=>{
  const row={mo_ta:'Một bản sách',media:[{kind:'image',url:'image'}]},workload=analysisWorkload(row);
  const samples=Array.from({length:6},(_,i)=>({workload,execution:{total_ms:(i+1)*10000,provider_timeout_ms:180000}}));
  assert.equal(averageAnalysisTime(workload,samples.slice(0,4)).average_ms,null);
  assert.equal(averageAnalysisTime(workload,samples).average_ms,35000);
  assert.equal(averageAnalysisTime(workload,[{workload,execution:{provider_timeout_ms:180000}},...samples]).sample_count,6);
  assert.equal(averageAnalysisTime({...workload,videos:1},samples).sample_count,0);
  assert.equal(averageAnalysisTime({...workload,text_chars:15000},samples).sample_count,0);
  assert.equal(averageAnalysisTime(workload,Array(30).fill(samples[0])).sample_count,20);
});
test('known video duration and bytes refine the groups, unknown duration is not reported as zero',()=>{
  const row={media:[{kind:'video',url:'video'}]},unknown=analysisWorkload(row);
  assert.equal(unknown.video_seconds,null);
  const known=analysisWorkload(row,[{kind:'video',sent:true,bytes:1024,duration_seconds:400}]);
  const sample={workload:known,execution:{total_ms:100000}};
  assert.equal(averageAnalysisTime(known,Array(5).fill(sample)).average_ms,100000);
  assert.equal(averageAnalysisTime({...known,video_seconds:30},[sample]).sample_count,0);
  assert.equal(averageAnalysisTime({...known,media_bytes:30000000},[sample]).sample_count,0);
});
test('only Admin can read workload/timing statistics; pending seller does not trigger statistics query',async()=>{
  let queried=0;
  const row={row_version:'0000000000000001',trang_thai_phien:'cho_kiem_duyet',media:[]};
  const service=createAiService({posts:{detail:async()=>row},config:{configured:true,autoAnalysis:true,model:'fixture'},
    model:{history:async()=>[],timingSamples:async()=>{queried++;return [];}},queue:{status:async()=>null}});
  const seller=await service.status(1,{vai_tro:'nguoi_dung',nguoi_dung_id:1});
  assert(!Object.hasOwn(seller,'timing'));assert.equal(queried,0);
  const admin=await service.status(1,{vai_tro:'admin',nguoi_dung_id:2});
  assert.equal(admin.timing.average_ms,null);assert.equal(queried,1);
});
