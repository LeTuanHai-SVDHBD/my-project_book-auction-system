/** Draft persistence and upload lifecycle are exercised without a mounted React component. */
import test from 'node:test';import assert from 'node:assert/strict';
import {createPostDrafts} from '../../frontend/src/services/postDrafts.js';
const storage=()=>{const rows=new Map();return {rows,getItem:key=>rows.get(key),setItem:(key,value)=>rows.set(key,value),removeItem:key=>rows.delete(key)};};
const id='627a9b50-6b68-4cce-9636-b073c6d88931';
const ticket={upload_id:id,url:'https://res.cloudinary.com/demo/video/upload/v1/a.mp4',kind:'video',expires_at:2000};
const opts={owner:1,mode:'create'};
const config={imageMaxBytes:100,videoMaxBytes:100,maxVideos:3};
const file={name:'sach.mov',size:12};
const data={fields:{ten_sach:'Sách quý',gia_toi_thieu:'999999999999999999',mo_ta_tinh_trang:'Bằng chứng',password:'do not save'},step:2,isbnMode:'none',isbn:'',removed:[]};
test('reload restores fields, 18-digit money, mode/post/account scope and request UUID; no credentials persisted',()=>{
 const s=storage(),registry=createPostDrafts({storage:s,uuid:()=>id});const first=registry.open(opts);first.save(data);
 assert(![...s.rows.values()][0].includes('do not save'));
 const second=createPostDrafts({storage:s}).open(opts);assert.equal(second.data.fields.gia_toi_thieu,data.fields.gia_toi_thieu);assert.equal(second.data.requestId,id);assert.equal(second.data.step,2);
 assert.deepEqual(registry.open({owner:2}).data.fields,{});assert.deepEqual(registry.open({...opts,mode:'resubmit',source:{bai_dang_id:9,row_version:'v1'}}).data.fields,{});
});
test('background upload finishes after unsubscription/navigation; re-open sees same draft without any second upload',async()=>{
 const s=storage();let finish,calls=0;const result=new Promise(r=>finish=r);
 const registry=createPostDrafts({storage:s,now:()=>1000,sessionRevision:()=>1,api:{identify:async()=>({kind:'video',mime:'video/quicktime'}),upload:async()=>{calls++;return result;}}});const first=registry.open(opts);first.save(data);const stop=first.subscribe(()=>{});const task=first.upload([file],config);await new Promise(r=>setImmediate(r));stop();assert(first.status.busy);
 const reopened=registry.open(opts);assert.equal(reopened,first);finish(ticket);await task;assert.equal(calls,1);assert.equal(reopened.data.media.length,1);assert.equal(reopened.data.fields.ten_sach,'Sách quý');
 const restored=createPostDrafts({storage:s,now:()=>1001}).open(opts);assert.equal(restored.data.media[0].upload_id,id);assert(!restored.status.busy);
});
test('explicit discard invalidates pending results, cleans late ready tickets and leaves a fresh draft empty',async()=>{
 let finish,deleted=0;const result=new Promise(r=>finish=r);const s=storage(),registry=createPostDrafts({storage:s,sessionRevision:()=>1,api:{identify:async()=>({kind:'video'}),upload:()=>result,discard:async()=>{deleted++;}}});const first=registry.open(opts);first.save(data);const task=first.upload([file],config);await new Promise(r=>setImmediate(r));first.clear();const fresh=registry.open(opts);finish(ticket);await task;assert.equal(deleted,1);assert.equal(fresh.data.media.length,0);assert.deepEqual(fresh.data.fields,{});assert.equal(s.rows.size,0);
});
test('success clears local draft without deleting files bound to the submitted post',async()=>{
 let deleted=0;const s=storage(),registry=createPostDrafts({storage:s,api:{discard:async()=>deleted++}}),d=registry.open(opts);d.data.media=[ticket];d.save(data);d.clear({submitted:true});assert.equal(s.rows.size,0);assert.equal(deleted,0);
});
test('ảnh chính giữ qua reload và bỏ lựa chọn nếu ảnh đã chọn bị gỡ',async()=>{
 const s=storage(),image={...ticket,kind:'image',url:'https://res.cloudinary.com/demo/image/upload/v1/a.jpg'};
 const api={discard:async()=>{}};
 const first=createPostDrafts({storage:s,now:()=>1000,api}).open(opts);
 first.data.media=[image];
 first.selectCover(image);
 const restored=createPostDrafts({storage:s,now:()=>1001,api}).open(opts);
 assert.equal(restored.data.coverKey,`upload:${id}`);
 restored.selectCover(ticket);
 assert.equal(restored.data.coverKey,`upload:${id}`);
 await restored.remove(image);
 assert.equal(restored.data.coverKey,null);
});
test('expired files and interrupted reload are explicit; source version change cannot apply stale edits',()=>{
 const s=storage(),r=createPostDrafts({storage:s}),d=r.open(opts);d.data.media=[ticket];d.data.pending=true;d.save(data);
 const restored=createPostDrafts({storage:s,now:()=>3000}).open(opts);assert.equal(restored.data.media.length,0);assert(restored.status.notice.includes('hết hạn'));assert(restored.status.notice.includes('chưa được xác nhận'));
 const source={bai_dang_id:9,row_version:'v1'},edit=r.open({...opts,mode:'resubmit',source});edit.save(data);
 const latest=createPostDrafts({storage:s}).open({...opts,mode:'resubmit',source:{...source,row_version:'v2'}});assert.deepEqual(latest.data.fields,{});assert(latest.status.notice.includes('đã thay đổi'));
});
test('storage blocked or malformed cannot crash the form; completed upload in memory survives a write error',async()=>{
 const s={getItem:()=>'{bad',setItem:()=>{throw Error('quota');}},r=createPostDrafts({storage:s,sessionRevision:()=>1,api:{identify:async()=>({kind:'video'}),upload:async()=>ticket}}),d=r.open(opts);d.save(data);assert(d.status.storageError.includes('Không lưu'));await d.upload([file],config);assert.equal(d.data.media.length,1);
 const weird=storage();weird.setItem('bookbid:post-draft:v1:1:create:new',JSON.stringify({sourceVersion:null,media:[null],removed:[null]}));assert.doesNotThrow(()=>createPostDrafts({storage:weird}).open(opts));
});
test('changed login stops unsent files; one rejected file does not lose other successful uploads or typed fields',async()=>{
 let revision=1,calls=0;const r=createPostDrafts({sessionRevision:()=>revision,api:{identify:async()=>({kind:'video'}),upload:async()=>{calls++;revision++;return ticket;}}}),d=r.open(opts);d.save(data);await d.upload([file,file],config);assert.equal(calls,1);assert.equal(d.data.media.length,1);assert(d.status.error.includes('Phiên đăng nhập'));assert.equal(d.data.fields.ten_sach,'Sách quý');
});
