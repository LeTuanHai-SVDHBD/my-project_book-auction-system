/** Mã chọn tab không chứa session ID/CSRF; chỉ reload được dùng lại mã để tab mới không kế thừa tài khoản. */
export const TAB_STORAGE_KEY='bookauction.tab';
const validId=/^[0-9a-f]{32}$/;
export function createTabIdentity({storage,navigationType,randomUUID}) {
  const saved=storage.getItem(TAB_STORAGE_KEY);
  // New documents can inherit sessionStorage from an opener/duplicated tab; rotate their selector.
  const id=navigationType==='reload'&&validId.test(saved||'')?saved:randomUUID().replaceAll('-','');
  if(!validId.test(id))throw new Error('Không tạo được mã tab. Vui lòng tải lại trang.');
  storage.setItem(TAB_STORAGE_KEY,id);return id;
}
let currentId;
export function getTabId(){
  if(!currentId){
    try{currentId=createTabIdentity({storage:window.sessionStorage,navigationType:performance.getEntriesByType('navigation')[0]?.type,randomUUID:()=>crypto.randomUUID()});}
    catch{throw new Error('Không thể giữ phiên đăng nhập trong tab này. Kiểm tra quyền lưu trữ của trình duyệt.');}
  }
  return currentId;
}
