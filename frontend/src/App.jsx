/** Điều hướng tài khoản, đăng sách/kiểm duyệt, danh mục và hạ tầng. */
import {useEffect,useState} from 'react';
import AccountPanel from './components/AccountPanel.jsx';
import InfrastructurePanel from './components/InfrastructurePanel.jsx';
import TransactionsPanel from './components/TransactionsPanel.jsx';
import ComplaintsPanel from './components/ComplaintsPanel.jsx';
import PostsPanel from './components/PostsPanel.jsx';
import {useAccountControl} from './services/accountControl.js';
export default function App(){
  const [tab,setTab]=useState('account');const [user,setUser]=useState(null);
  useAccountControl(user);
  useEffect(()=>{const signedOut=()=>{setUser(null);setTab('account');};window.addEventListener('account:signed-out',signedOut);return()=>window.removeEventListener('account:signed-out',signedOut);},[]);
  const selected=['mine','trades'].includes(tab)&&user?.vai_tro!=='nguoi_dung'||tab==='pending'&&user?.vai_tro!=='admin'||tab==='complaints'&&!user?'account':tab;
  const button=(value,label)=><button aria-current={selected===value?'page':undefined} onClick={()=>setTab(value)}>{label}</button>;
  return <><nav className="app-nav" aria-label="Điều hướng chính"><a className="brand" href="#" onClick={event=>{event.preventDefault();setTab('catalog');}}><span className="mark">B</span>BookAuction</a><div>{button('catalog','Danh mục')}{user?.vai_tro==='nguoi_dung'&&button('mine','Bài của tôi')}{user?.vai_tro==='admin'&&button('pending','Kiểm duyệt')}{user?.vai_tro==='nguoi_dung'&&button('trades','Giao dịch')}{user&&button('complaints',user.vai_tro==='admin'?'Khiếu nại':'Khiếu nại của tôi')}{button('account','Tài khoản')}{button('infra','Kiểm tra hệ thống')}</div></nav>
    <div hidden={selected!=='account'}><AccountPanel onUserChange={setUser}/></div>
    {['catalog','mine','pending'].includes(selected)&&<PostsPanel key={`${selected}-${user?.nguoi_dung_id||'guest'}`} mode={selected} user={user}/>}
    {selected==='trades'&&user&&<TransactionsPanel key={user.nguoi_dung_id} user={user}/>}
    {selected==='complaints'&&user&&<ComplaintsPanel key={user.nguoi_dung_id} user={user}/>}
    {selected==='infra'&&<InfrastructurePanel/>}
  </>;
}
