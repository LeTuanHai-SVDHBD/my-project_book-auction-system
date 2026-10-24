/** Ví dụ phép tính chạy độc lập, không cần API key, SQL hoặc Redis. */
import {readFile} from 'node:fs/promises';
import {scoreObservations} from '../backend/src/ai/scoring.js';
const fixture=JSON.parse(await readFile(new URL('../backend/test/fixtures/ai-observations.json',import.meta.url),'utf8'));
const result=scoreObservations(fixture.observations,{mediaIds:fixture.mediaIds});
console.log(JSON.stringify({du_lieu_mau:fixture.observations.criteria.map(x=>({tieu_chi:x.id,trang_thai:x.status,quan_sat:x.findings})),mong_doi:fixture.expected,
  ket_qua:{diem_do_hiem:result.diem_do_hiem,diem_tinh_trang:result.diem_tinh_trang},doi_chieu:result.tinh_diem},null,2));
