/** Thêm biến cấu hình AI còn thiếu, giữ nguyên .env hiện có; người dùng chủ động bật Gemini. */
import {existsSync,readFileSync,appendFileSync} from 'node:fs';
const target=new URL('../.env',import.meta.url);
if(!existsSync(target)){console.error('Chưa có .env. Chạy npm.cmd run setup trước.');process.exitCode=1;}
else{
  const contents=readFileSync(target,'utf8'),defaults={AI_ENABLED:'false',GEMINI_API_KEY:'CHANGE_ME',GEMINI_MODEL:'gemini-3.8-flash',AI_PROVIDER_TIMEOUT_MS:'60000',AI_MEDIA_TOTAL_MB:'12'};
  const additions=Object.entries(defaults).filter(([key])=>!new RegExp(`^\\s*(?:export\\s+)?${key}\\s*=`,'m').test(contents)).map(([key,value])=>`${key}=${value}`);
  if(additions.length)appendFileSync(target,'\n# Gemini: chỉ backend; bật sau khi điền API key\n'+additions.join('\n')+'\n');
  console.log('Đã kiểm tra cấu hình AI. Điền GEMINI_API_KEY và đặt AI_ENABLED=true trên máy bạn để bật; giữ khóa ở backend.');
}
