/** Setup không ghi đè khóa hoặc cờ bật AI hiện có; chạy lại không nhân bản cấu hình. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,copyFile,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
test('setup:ai bảo toàn cấu hình và chạy lại idempotent',async t=>{
  const root=await mkdtemp(join(tmpdir(),'book-ai-setup-'));t.after(()=>rm(root,{recursive:true,force:true}));await mkdir(join(root,'scripts'));
  await copyFile(new URL('../../scripts/setupAi.mjs',import.meta.url),join(root,'scripts','setupAi.mjs'));
  const path=join(root,'.env'),original='DB_PASSWORD=fixture-only\nAI_ENABLED=true\nGEMINI_API_KEY=existing-fixture-key\n';await writeFile(path,original);
  const run=()=>{const result=spawnSync(process.execPath,[join(root,'scripts','setupAi.mjs')],{encoding:'utf8'});assert.equal(result.status,0);assert(!result.stdout.includes('existing-fixture-key'));};
  run();const first=await readFile(path,'utf8');assert(first.startsWith(original));assert.equal((first.match(/^AI_ENABLED=/gm)||[]).length,1);run();assert.equal(await readFile(path,'utf8'),first);
});
