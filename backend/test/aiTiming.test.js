import test from 'node:test';
import assert from 'node:assert/strict';
import {analysisWorkload,estimateAnalysisTime} from '../src/ai/timing.js';
import {createAiService} from '../src/services/ai.service.js';

test('a fresh listing immediately receives an estimated range without historical samples',()=>{
  const workload=analysisWorkload({mo_ta:'Một bản sách',media:[{kind:'image',url:'image'}]});
  const timing=estimateAnalysisTime(workload);
  assert(timing.estimated_min_ms>0);
  assert(timing.estimated_max_ms>timing.estimated_min_ms);
  assert.equal(timing.method,'workload-heuristic-v1');
  assert(!Object.hasOwn(timing,'minimum_samples'));
  assert(!Object.hasOwn(timing,'average_ms'));
});
test('longer text, more photos and more videos increase the workload estimate independently',()=>{
  const base=analysisWorkload({mo_ta:'Sách',media:[]});
  const original=estimateAnalysisTime(base);
  for(const patch of [{text_chars:12000},{images:30},{videos:2}]) {
    const next=estimateAnalysisTime({...base,...patch});
    assert(next.estimated_min_ms>original.estimated_min_ms);
    assert(next.estimated_max_ms>original.estimated_max_ms);
  }
});
test('unknown video duration is explicit; measured duration and file bytes refine the estimate',()=>{
  const row={media:[{kind:'video',url:'video'}]};
  const unknown=estimateAnalysisTime(analysisWorkload(row));
  assert.equal(unknown.video_duration_known,false);
  const partial=analysisWorkload({media:[{kind:'video',url:'a'},{kind:'video',url:'b'}]},
    [{kind:'video',sent:true,bytes:1024,duration_seconds:30}]);
  assert.equal(partial.video_seconds,null);assert.equal(partial.media_bytes,null);
  const small=analysisWorkload(row,[{kind:'video',sent:true,bytes:1048576,duration_seconds:30}]);
  const big=analysisWorkload(row,[{kind:'video',sent:true,bytes:50000000,duration_seconds:600}]);
  assert.equal(estimateAnalysisTime(small).video_duration_known,true);
  assert(estimateAnalysisTime(big).estimated_max_ms>estimateAnalysisTime(small).estimated_max_ms);
  assert(estimateAnalysisTime({...big,media_bytes:100000000}).estimated_max_ms>estimateAnalysisTime(big).estimated_max_ms);
});
test('only Admin receives the immediate estimate; statistics storage is not queried',async()=>{
  let queried=0;
  const row={row_version:'0000000000000001',trang_thai_phien:'cho_kiem_duyet',media:[]};
  const service=createAiService({posts:{detail:async()=>row},config:{configured:true,autoAnalysis:true,model:'fixture'},
    model:{history:async()=>[],timingSamples:async()=>{queried++;throw Error('No history');}},queue:{status:async()=>null}});
  const seller=await service.status(1,{vai_tro:'nguoi_dung',nguoi_dung_id:1});
  assert(!Object.hasOwn(seller,'timing'));
  const admin=await service.status(1,{vai_tro:'admin',nguoi_dung_id:2});
  assert(admin.timing.estimated_min_ms>0);assert.equal(queried,0);
});
