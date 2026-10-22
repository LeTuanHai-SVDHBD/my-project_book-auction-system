/** Điều hướng tài khoản và trang kiểm tra hạ tầng. */
import { useState } from 'react';
import AccountPanel from './components/AccountPanel.jsx';
import InfrastructurePanel from './components/InfrastructurePanel.jsx';
export default function App() {
  const [tab, setTab] = useState('account');
  return <>
    <nav className="app-nav" aria-label="Điều hướng chính"><a className="brand" href="#" onClick={event => { event.preventDefault(); setTab('account'); }}><span className="mark">B</span>BookAuction</a>
      <div><button aria-current={tab === 'account' ? 'page' : undefined} onClick={() => setTab('account')}>Tài khoản</button>
        <button aria-current={tab === 'infra' ? 'page' : undefined} onClick={() => setTab('infra')}>Kiểm tra hệ thống</button></div></nav>
    {tab === 'account' ? <AccountPanel/> : <InfrastructurePanel/>}
  </>;
}
