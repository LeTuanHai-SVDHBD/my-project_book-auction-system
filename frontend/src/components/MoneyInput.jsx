/** Ô nhập VND: chỉ hiển thị số và dấu nhóm nghìn, hidden input giữ chuỗi gốc gửi API. */
import {useLayoutEffect,useRef,useState} from 'react';
import {editMoneyInput,formatMoneyInput,moneyDigits,positionAfterDigits} from '../utils/moneyInput.js';
export default function MoneyInput({name,label,initialValue='',required=true,followSuggestion=false}){
  const [digits,setDigits]=useState(()=>moneyDigits(initialValue));const [error,setError]=useState('');
  const input=useRef(null);const pendingCaret=useRef(null);
  const edited=useRef(false);
  useLayoutEffect(()=>{if(followSuggestion&&!edited.current)setDigits(moneyDigits(initialValue));},[followSuggestion,initialValue]);
  useLayoutEffect(()=>{if(pendingCaret.current!==null&&input.current){input.current.setSelectionRange(pendingCaret.current,pendingCaret.current);pendingCaret.current=null;}});
  function update(event){
    edited.current=true;
    const element=event.target;const next=editMoneyInput(element.value,element.selectionStart??element.value.length);
    if(next.digits.length>18){element.value=formatMoneyInput(digits);element.setCustomValidity('Tối đa 18 chữ số.');setError('Tối đa 18 chữ số. Giá trị vượt giới hạn chưa được nhập.');return;}
    element.setCustomValidity('');setError('');pendingCaret.current=next.caret;setDigits(next.digits);
    // A rejected character leaves the state unchanged; restore the DOM and caret immediately too.
    element.value=formatMoneyInput(next.digits);element.setSelectionRange(next.caret,next.caret);
  }
  function removeSeparator(event){
    if(event.ctrlKey||event.metaKey||event.altKey)return;
    const element=event.target;const start=element.selectionStart,end=element.selectionEnd;
    if(start===null||start!==end||!['Backspace','Delete'].includes(event.key))return;
    const dot=event.key==='Backspace'?start-1:start;
    if(element.value[dot]!=='.')return;
    event.preventDefault();element.setCustomValidity('');
    edited.current=true;
    const left=element.value.slice(0,dot).replace(/[^0-9]/g,'').length;
    const removeAt=event.key==='Backspace'?left-1:left;
    const next=moneyDigits(digits.slice(0,removeAt)+digits.slice(removeAt+1));
    pendingCaret.current=positionAfterDigits(formatMoneyInput(next),Math.max(0,removeAt));setDigits(next);setError('');
  }
  return <label>{label}<input ref={input} type="text" aria-label={label} inputMode="numeric" autoComplete="off" required={required}
    value={formatMoneyInput(digits)} onChange={update} onKeyDown={removeSeparator} aria-describedby={error?`${name}-hint`:undefined}/>
    <input type="hidden" name={name} value={digits}/>{error&&<span id={`${name}-hint`} className="error" role="status">{error}</span>}
  </label>;
}
