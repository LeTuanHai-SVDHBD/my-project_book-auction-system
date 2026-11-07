/** Renamed media must normalize safely; containers need more than a misleading extension. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {detectMedia,mediaFormats} from '../../shared/mediaFormats.js';
import {mediaDisplayUrl} from '../../shared/mediaDelivery.js';
import {verifyMedia} from '../src/services/cloudinary.service.js';
import {prepareAiMedia} from '../src/ai/media.js';
const bmff=(brand,compatible=[])=>{const b=Buffer.alloc(16+compatible.length*4);b.writeUInt32BE(b.length);b.write('ftyp',4);b.write(brand,8);compatible.forEach((x,i)=>b.write(x,16+i*4));return b;};
const ebml=type=>Buffer.concat([Buffer.from([0x1a,0x45,0xdf,0xa3,0x80+3+type.length,0x42,0x82,0x80+type.length]),Buffer.from(type)]);
test('15 formats share recognition; compatible AVIF brands beat generic HEIF; EBML DocType distinguishes WebM/MKV',()=>{
 const cases=[['image/jpeg',Buffer.from([255,216,255])],['image/png',Buffer.from([137,80,78,71,13,10,26,10])],['image/webp',Buffer.from('RIFF0000WEBP')],['image/gif',Buffer.from('GIF89a')],['image/bmp',Buffer.from('BM')],['image/tiff',Buffer.from([73,73,42,0])],['image/avif',bmff('mif1',['avif'])],['image/heic',bmff('heic')],['image/heif',bmff('mif1')],['video/mp4',bmff('isom',['mp42'])],['video/quicktime',bmff('qt  ')],['video/x-m4v',bmff('M4V ')],['video/webm',ebml('webm')],['video/x-matroska',ebml('matroska')],['video/x-msvideo',Buffer.from('RIFF0000AVI ')]];
 assert.equal(cases.length,mediaFormats.length);
 for(const [mime,bytes] of cases){const found=detectMedia(bytes);assert.equal(found?.mime,mime);assert.equal(verifyMedia(bytes,mime,found.kind).mime,mime);}
});
test('reject HTML/SVG/PDF/executable, truncated and unknown containers, or image sent to video route',()=>{
 for(const value of ['<svg></svg>','<html>image.jpg</html>','%PDF-1.7','MZexe'])assert.equal(detectMedia(Buffer.from(value)),null);
 for(const bytes of [bmff('zzzz'),bmff('isom').subarray(0,14),Buffer.from([26,69,223,163]),ebml('audio')])assert.equal(detectMedia(bytes),null);
 assert.throws(()=>verifyMedia(bmff('heic'),'video/mp4','video'),{status:415});
 assert.throws(()=>verifyMedia(Buffer.from('GIF89a'),'image/jpeg','image'),{status:415});
});
test('display conversions leave originals unchanged; unsupported external URLs never become conversion targets',()=>{
 const original='https://res.cloudinary.com/demo/image/upload/v1/bookauction/1/x.heic';
 assert.equal(mediaDisplayUrl(original,'image'),'https://res.cloudinary.com/demo/image/upload/f_jpg/v1/bookauction/1/x.jpg');
 assert.equal(mediaDisplayUrl('https://res.cloudinary.com/demo/video/upload/v1/x.mov','video'),'https://res.cloudinary.com/demo/video/upload/f_mp4,vc_h264,ac_aac/v1/x.mp4');
 for(const url of ['https://evil.test/a.heic','http://res.cloudinary.com/demo/image/upload/x.heic','https://res.cloudinary.com.evil.test/image/upload/x.heic','https://res.cloudinary.com/demo/image/upload/a.jpg'])assert.equal(mediaDisplayUrl(url,'image'),url);
});
test('AI receives converted JPEG for HEIC while evidence manifest retains its original Cloudinary URL',async()=>{
 const url='https://res.cloudinary.com/demo/image/upload/v1/a.heic';let fetched;
 const result=await prepareAiMedia({media:[{id:'M1',url,kind:'image'}],config:{cloudName:'demo',mediaMaxBytes:1000},signal:new AbortController().signal,fetchImpl:async target=>{fetched=target;return new Response(Buffer.from([255,216,255,0]),{headers:{'content-type':'image/jpeg'}});}});
 assert(fetched.includes('/f_jpg/'));assert.equal(result.parts[1].mime_type,'image/jpeg');assert.equal(result.manifest[0].url,url);assert.equal(result.manifest[0].sent,true);
});
