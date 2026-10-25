/** Combobox một lựa chọn: nhập để lọc có/không dấu, chỉ lưu giá trị được chọn trong danh mục. */
import {useEffect,useId,useRef,useState} from 'react';
import {searchBookGenres} from '../../../shared/bookGenres.js';
export default function GenreSelect(){
  const id=useId(),input=useRef(null),list=useRef(null);
  const [query,setQuery]=useState(''),[selected,setSelected]=useState(''),[open,setOpen]=useState(false),[active,setActive]=useState(-1);
  const groups=searchBookGenres(query===selected?'':query),items=groups.flatMap(group=>group.items);
  function choose(value){setSelected(value);setQuery(value);setOpen(false);setActive(-1);input.current.setCustomValidity('');input.current.focus();}
  function change(event){const value=event.target.value;setQuery(value);setSelected('');setOpen(true);setActive(-1);event.target.setCustomValidity(value?'Hãy chọn một thể loại trong danh sách hoặc xóa ô tìm kiếm.':'');}
  function keys(event){
    if(['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();setOpen(true);setActive(value=>items.length?(value+(event.key==='ArrowDown'?1:-1)+items.length)%items.length:-1);}
    else if(event.key==='Enter'&&open){event.preventDefault();if(items[active<0?0:active])choose(items[active<0?0:active]);}
    else if(event.key==='Escape'){setOpen(false);setActive(-1);}
  }
  useEffect(()=>{if(open&&active>=0)list.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({block:'nearest'});},[open,active]);
  return <div className="genre-select" onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget))setOpen(false);}}>
    <label htmlFor={id}>Thể loại</label><div className="genre-search"><input id={id} ref={input} role="combobox" autoComplete="off" aria-autocomplete="list" aria-expanded={open} aria-controls={`${id}-list`} aria-activedescendant={open&&active>=0?`${id}-option-${active}`:undefined} aria-describedby={`${id}-hint`} value={query} placeholder="Tìm hoặc chọn thể loại" onChange={change} onFocus={()=>setOpen(true)} onKeyDown={keys}/><button type="button" aria-label="Mở danh sách thể loại" onMouseDown={event=>event.preventDefault()} onClick={()=>{input.current.focus();setOpen(!open);}}>⌄</button></div>
    <input type="hidden" name="the_loai" value={selected}/>
    {open&&<div id={`${id}-list`} ref={list} role="listbox" aria-label="Danh sách thể loại" className="genre-options">{groups.map(group=><div role="group" aria-label={group.name} key={group.name}><div className="genre-group">{group.name}</div>{group.items.map(value=>{const index=items.indexOf(value);return <button type="button" role="option" aria-selected={selected===value} id={`${id}-option-${index}`} data-index={index} className={index===active?'genre-active':''} key={value} onMouseDown={event=>event.preventDefault()} onClick={()=>choose(value)}>{value}</button>;})}</div>)}{!items.length&&<p>Không tìm thấy thể loại. Thử từ khóa khác.</p>}</div>}
    <small id={`${id}-hint`} className="field-hint">Gõ để tìm, rồi chọn trong danh sách. Có thể để trống.</small>
  </div>;
}
