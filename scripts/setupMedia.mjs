/** Bổ sung cấu hình media mẫu còn thiếu; giữ nguyên mọi giá trị cấu hình cá nhân. */
import {existsSync,readFileSync,appendFileSync} from 'node:fs';
const target=new URL('../.env',import.meta.url);
if (!existsSync(target)) {console.error('Chưa có .env. Chạy npm.cmd run setup trước.');process.exitCode=1;}
else {
  const contents=readFileSync(target,'utf8');
  const defaults={CLOUDINARY_CLOUD_NAME:'CHANGE_ME',CLOUDINARY_API_KEY:'CHANGE_ME',CLOUDINARY_API_SECRET:'CHANGE_ME',MEDIA_IMAGE_MAX_MB:'10',MEDIA_VIDEO_MAX_MB:'50',MEDIA_MAX_IMAGES:'12',MEDIA_MAX_VIDEOS:'3'};
  const additions=Object.entries(defaults).filter(([name])=>!new RegExp(`^\\s*(?:export\\s+)?${name}\\s*=`,'m').test(contents)).map(([name,value])=>`${name}=${value}`);
  if (additions.length) appendFileSync(target,'\n# Cloudinary: chỉ backend sử dụng\n'+additions.join('\n')+'\n');
  console.log('Đã kiểm tra cấu hình media. Mở .env và điền ba giá trị Cloudinary trên máy bạn; không gửi API secret vào chat/Git.');
}
