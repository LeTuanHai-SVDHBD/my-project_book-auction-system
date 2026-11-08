/** Phản hồi thao tác dùng chung, giữ khi điều hướng và tự ẩn. */
import {createContext,useContext,useEffect,useRef,useState} from 'react';

const SuccessContext=createContext(null);
const DISPLAY_MS=4000;
export const useSuccessFeedback=()=>useContext(SuccessContext);

export default function SuccessFeedback({children}){
  const [feedback,setFeedback]=useState(null);
  const toast=useRef(null);
  useEffect(()=>{
    if(!feedback)return;
    const element=toast.current;
    // Popover xuất hiện trên cả hộp thoại vừa mở sau khi gửi khiếu nại.
    element.showPopover?.();
    const timer=setTimeout(()=>setFeedback(current=>current===feedback?null:current),DISPLAY_MS);
    return ()=>{
      clearTimeout(timer);
      element.hidePopover?.();
    };
  },[feedback]);
  return <SuccessContext.Provider value={setFeedback}>
    {children}
    <div ref={toast} className="success-feedback" popover="manual" role="status" hidden={!feedback}>
      {feedback&&<><span aria-hidden="true">✓</span>{feedback.message}</>}
    </div>
  </SuccessContext.Provider>;
}
