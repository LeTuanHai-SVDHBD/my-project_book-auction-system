/** Hình học kính lúp: vùng ảnh thật, tỷ lệ, mép ảnh và giới hạn viewport; không cần trình duyệt/dịch vụ. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {containedImage,imageZoomView} from '../../frontend/src/utils/imageZoom.js';
const rect={left:30,top:100,width:500,height:500},frame={left:10,top:80,right:550};
test('kính lúp căn theo ảnh contain, bỏ phần trống của ảnh ngang/dọc',()=>{
  assert.deepEqual(containedImage(rect,1000,500),{left:30,top:225,width:500,height:250});
  assert.deepEqual(containedImage(rect,500,1000),{left:155,top:100,width:250,height:500});
  assert.equal(containedImage(rect,0,0),null);assert.equal(containedImage({...rect,width:0},100,100),null);
  const image=containedImage(rect,1000,500);
  assert.equal(imageZoomView({image,frame,point:{x:60,y:120},viewport:{width:1440,height:1000}}),null);
});
test('khung soi cùng vùng lens ở giữa/bốn góc, không vượt ảnh hoặc viewport',()=>{
  for(const [w,h] of [[1000,500],[500,1000],[800,800],[20,1000]]){
    const image=containedImage(rect,w,h);
    for(const [x,y] of [[0,0],[1,0],[0,1],[1,1],[0.5,0.5]]){
      const view=imageZoomView({image,frame,point:{x:image.left+x*image.width,y:image.top+y*image.height},viewport:{width:1440,height:700}});
      assert(view);assert(view.lens.left>=image.left-0.001);assert(view.lens.top>=image.top-0.001);
      assert(view.lens.left+view.lens.width<=image.left+image.width+0.001);assert(view.lens.top+view.lens.height<=image.top+image.height+0.001);
      assert(view.panel.left>frame.right);assert(view.panel.left+view.panel.width+4<=1440);assert(view.panel.top+view.panel.height+4<=700);
      const factor=view.detail.width/image.width;assert(Math.abs(view.detail.height/image.height-factor)<0.001);
      assert(Math.abs(view.lens.width*factor-view.panel.width)<0.001);assert(Math.abs(view.lens.height*factor-view.panel.height)<0.001);
      assert(view.detail.left<=0&&view.detail.top<=0);
      assert(view.detail.width+view.detail.left>=view.panel.width-0.001);assert(view.detail.height+view.detail.top>=view.panel.height-0.001);
    }
  }
});
test('màn hình hẹp/thiếu khoảng trống không mở panel, panel cuộn gần đáy vẫn trong màn hình',()=>{
  const image=containedImage(rect,1000,500),point={x:250,y:300};
  for(const viewport of [{width:390,height:800},{width:1100,height:100}])assert.equal(imageZoomView({image,frame,point,viewport}),null);
  assert.equal(imageZoomView({image,frame:{...frame,right:900},point,viewport:{width:1100,height:800}}),null);
  const view=imageZoomView({image,frame:{...frame,top:650},point,viewport:{width:1440,height:700}});assert.equal(view.panel.top,264);
});
