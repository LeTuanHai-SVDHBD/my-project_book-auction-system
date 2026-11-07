/** Tiền VND nhập số thuần, không đổi định dạng/caret khi focus; giá có phân cách hiển thị ở dòng xem trước. */
import {useLayoutEffect,useRef,useState} from 'react';
import {formatMoneyInput,moneyDigits} from '../utils/moneyInput.js';
export default function MoneyInput({name,label,initialValue='',required=true,followSuggestion=false}){
  const [digits,setDigits]=useState(()=>moneyDigits(initialValue)),[draft,setDraft]=useState(()=>moneyDigits(initialValue));
  const [error,setError]=useState('');
  const input=useRef(null),accepted=useRef(digits),composing=useRef(false),edited=useRef(false),selection=useRef(null);
  useLayoutEffect(()=>{if(followSuggestion&&!edited.current){const next=moneyDigits(initialValue);accepted.current=next;setDigits(next);setDraft(next);}},[followSuggestion,initialValue]);
  useLayoutEffect(()=>{if(selection.current&&input.current){input.current.setSelectionRange(...selection.current);selection.current=null;}});
  function accept(element){
    const value=element.value,next=moneyDigits(value);
    if(next.length>18){setDraft(accepted.current);setError('Tối đa 18 chữ số. Giá trị vượt giới hạn chưa được nhập.');return;}
    if(next!==value){const all=value.replace(/[^0-9]/g,''),before=value.slice(0,element.selectionStart??value.length).replace(/[^0-9]/g,'').length;const caret=Math.max(0,before-(all.length-next.length));selection.current=[caret,caret];}
    accepted.current=next;setDigits(next);setDraft(next);setError('');
  }
  function update(event){edited.current=true;if(composing.current||event.nativeEvent.isComposing){setDraft(event.target.value);return;}accept(event.target);}
  return <label>{label}<input ref={input} type="text" aria-label={label} inputMode="numeric" autoComplete="off" required={required}
    value={draft} onChange={update}
    onCompositionStart={()=>{composing.current=true;}} onCompositionEnd={event=>{composing.current=false;edited.current=true;accept(event.target);}}
    onBlur={event=>{if(composing.current){composing.current=false;accept(event.target);}selection.current=null;}}
    aria-describedby={error?`${name}-hint`:undefined}/>
    <input type="hidden" name={name} value={digits}/>{digits&&<small className="field-hint">Giá trị: {formatMoneyInput(digits)} đ</small>}
    {error&&<span id={`${name}-hint`} className="error" role="status">{error}</span>}
  </label>;
}
