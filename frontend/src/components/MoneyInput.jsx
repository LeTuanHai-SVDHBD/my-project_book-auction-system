/** Tiền VND hiển thị theo nhóm nghìn trong lúc nhập; trường gửi đi vẫn là chuỗi chữ số. */
import {useLayoutEffect,useRef,useState} from 'react';
import {editMoneyInput,formatMoneyInput,moneyDigits,positionAfterDigits} from '../utils/moneyInput.js';
const fieldValue=digits=>({digits,display:formatMoneyInput(digits)});
export default function MoneyInput({name,label,initialValue='',required=true,followSuggestion=false}){
  const [field,setField]=useState(()=>fieldValue(moneyDigits(initialValue)));
  const [error,setError]=useState('');
  const input=useRef(null),accepted=useRef(field.digits),composing=useRef(false),edited=useRef(false),selection=useRef(null);
  useLayoutEffect(()=>{if(followSuggestion&&!edited.current){const next=moneyDigits(initialValue);accepted.current=next;setField(fieldValue(next));}},[followSuggestion,initialValue]);
  useLayoutEffect(()=>{if(selection.current!==null&&input.current){input.current.setSelectionRange(selection.current,selection.current);selection.current=null;}});
  function accept(element,inputType){
    const previous=formatMoneyInput(accepted.current);
    const {digits,caret}=editMoneyInput(element.value,element.selectionStart??element.value.length,previous,inputType);
    if(digits.length>18){
      const before=element.value.slice(0,element.selectionStart??element.value.length).replace(/[^0-9]/g,'').length;
      selection.current=positionAfterDigits(previous,before);
      setField(fieldValue(accepted.current));setError('Tối đa 18 chữ số. Giá trị vượt giới hạn chưa được nhập.');return;
    }
    selection.current=caret;
    accepted.current=digits;setField(fieldValue(digits));setError('');
  }
  function update(event){
    edited.current=true;
    if(composing.current||event.nativeEvent.isComposing){setField({digits:accepted.current,display:event.target.value});return;}
    accept(event.target,event.nativeEvent.inputType);
  }
  return <label>{label}<input ref={input} type="text" aria-label={label} inputMode="numeric" autoComplete="off" required={required}
    value={field.display} onChange={update}
    onCompositionStart={()=>{composing.current=true;}} onCompositionEnd={event=>{composing.current=false;edited.current=true;accept(event.target);}}
    onBlur={event=>{if(composing.current){composing.current=false;accept(event.target);}selection.current=null;}}
    aria-describedby={[field.digits&&`${name}-value`,error&&`${name}-hint`].filter(Boolean).join(' ')||undefined}/>
    <input type="hidden" name={name} value={field.digits}/>{field.digits&&<small id={`${name}-value`} className="field-hint">Giá trị: {formatMoneyInput(field.digits)} đ</small>}
    {error&&<span id={`${name}-hint`} className="error" role="status">{error}</span>}
  </label>;
}
