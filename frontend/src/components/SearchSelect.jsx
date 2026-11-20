/** Một lựa chọn có tìm kiếm; chỉ giá trị đã chọn được lưu vào biểu mẫu. */
import {useEffect,useId,useRef,useState} from 'react';

export default function SearchSelect({
  name,label,initialValue='',placeholder,listLabel,noResults,invalidMessage,hint,search,inputMode,onValueChange,
}){
  const id=useId(),input=useRef(null),list=useRef(null);
  const [query,setQuery]=useState(initialValue),[selected,setSelected]=useState(initialValue);
  const [open,setOpen]=useState(false),[active,setActive]=useState(-1);
  const groups=search(query===selected?'':query);
  const items=groups.flatMap(group=>group.items);
  const indexes=new Map(items.map((value,index)=>[value,index]));

  function choose(value){
    setSelected(value);setQuery(value);setOpen(false);setActive(-1);
    input.current.setCustomValidity('');
    onValueChange?.(value);
  }
  function change(event){
    const value=event.target.value;
    setQuery(value);setSelected('');setOpen(true);setActive(-1);
    event.target.setCustomValidity(value?invalidMessage:'');
  }
  function keys(event){
    if(event.key==='ArrowDown'||event.key==='ArrowUp'){
      event.preventDefault();
      setOpen(true);
      const direction=event.key==='ArrowDown'?1:-1;
      setActive(value=>!items.length?-1:value<0?(direction===1?0:items.length-1):(value+direction+items.length)%items.length);
    }else if(event.key==='Enter'&&open){
      event.preventDefault();
      const value=items[active<0?0:active];
      if(value!==undefined)choose(value);
    }else if(event.key==='Escape'&&open){
      event.preventDefault();
      setOpen(false);setActive(-1);
    }
  }
  useEffect(()=>{
    if(open&&active>=0)list.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({block:'nearest'});
  },[open,active]);

  return <div className="search-select" onBlur={event=>{
    if(!event.currentTarget.contains(event.relatedTarget)){setOpen(false);setActive(-1);}
  }}>
    <label htmlFor={id}>{label}</label>
    <div className="search-select-input">
      <input id={id} ref={input} role="combobox" autoComplete="off" aria-autocomplete="list"
        aria-expanded={open} aria-controls={open?`${id}-list`:undefined}
        aria-activedescendant={open&&active>=0?`${id}-option-${active}`:undefined}
        aria-describedby={`${id}-hint`} value={query} placeholder={placeholder}
        inputMode={inputMode}
        onChange={change} onFocus={()=>setOpen(true)} onClick={()=>setOpen(true)} onKeyDown={keys}/>
      <button type="button" aria-label={`Mở ${listLabel.toLowerCase()}`}
        onMouseDown={event=>event.preventDefault()} onClick={()=>{input.current.focus();setOpen(!open);setActive(-1);}}>⌄</button>
      {open&&<div id={`${id}-list`} ref={list} role="listbox" aria-label={listLabel} className="search-select-options">
        {groups.map(group=><div key={group.name??'options'} role={group.name?'group':'presentation'} aria-label={group.name}>
          {group.name&&<div className="search-select-group">{group.name}</div>}
          {group.items.map(value=>{
            const index=indexes.get(value);
            return <button type="button" tabIndex={-1} role="option" aria-selected={selected===value}
              id={`${id}-option-${index}`} data-index={index} className={index===active?'search-select-active':''}
              key={value} onMouseDown={event=>event.preventDefault()} onClick={()=>choose(value)}>{value}</button>;
          })}
        </div>)}
        {!items.length&&<p>{noResults}</p>}
      </div>}
    </div>
    <input type="hidden" name={name} value={selected}/>
    <small id={`${id}-hint`} className="field-hint">{hint}</small>
  </div>;
}
