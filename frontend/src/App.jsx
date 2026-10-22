/** Điều hướng tài khoản, đăng sách/kiểm duyệt, danh mục và hạ tầng. */
import {useState} from 'react';
import AccountPanel from './components/AccountPanel.jsx';
import InfrastructurePanel from './components/InfrastructurePanel.jsx';
import PostsPanel from './components/PostsPanel.jsx';
export default function App(){
  const [tab,setTab]=useState('account');const [user,setUser]=useState(null);
  const selected=tab==='mine'&&user?.vai_tro!=='nguoi_dung'||tab==='pending'&&user?.vai_tro!=='admin'?'account':tab;
  const button=(value,label)=><button aria-current={selected===value?'page':undefined} onClick={()=>setTab(value)}>{label}</button>;
  return <><nav className="app-nav" aria-label="Điều hướng chính"><a className="brand" href="#" onClick={event=>{event.preventDefault();setTab('catalog');}}><span className="mark">B</span>BookAuction</a><div>{button('catalog','Danh mục')}{user?.vai_tro==='nguoi_dung'&&button('mine','Bài của tôi')}{user?.vai_tro==='admin'&&button('pending','Kiểm duyệt')}{button('account','Tài khoản')}{button('infra','Kiểm tra hệ thống')}</div></nav>
    <div hidden={selected!=='account'}><AccountPanel onUserChange={setUser}/></div>
    {['catalog','mine','pending'].includes(selected)&&<PostsPanel key={`${selected}-${user?.nguoi_dung_id||'guest'}`} mode={selected}/>}
    {selected==='infra'&&<InfrastructurePanel/>}
  </>;
}
