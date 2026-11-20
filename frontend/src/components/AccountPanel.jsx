/** Đăng ký, đăng nhập và thông tin tài khoản; không lưu xác thực vào storage. */
import { useEffect, useState } from 'react';
import { useSuccessFeedback } from './SuccessFeedback.jsx';
import { authApi } from '../services/authApi.js';
export default function AccountPanel({ user, onUserChange: setUser }) {
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sessionNotice, setSessionNotice] = useState('');
  const [retryUntil, setRetryUntil] = useState(0);
  const [now, setNow] = useState(Date.now);
  const retrySeconds = Math.max(0, Math.ceil((retryUntil - now) / 1000));
  const coolingDown = retrySeconds > 0;
  useEffect(() => {
    if (!coolingDown) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [coolingDown]);
  const notify = useSuccessFeedback();
  const [reload, setReload] = useState(0);
  function showFailure(failure, fallback) {
    if (failure.status === 429 && failure.retryAfterSeconds > 0) {
      const time = Date.now(); setNow(time); setRetryUntil(time + failure.retryAfterSeconds * 1000); setError('');
    } else setError(failure.message || fallback);
  }
  useEffect(() => {
    let canceled = false;
    setLoading(true); setError('');
    authApi.current().then(value => { if (!canceled) setUser(value); })
      .catch(failure => { if (!canceled) showFailure(failure, 'Chưa tải được tài khoản. Kiểm tra API và Redis rồi thử lại.'); })
      .finally(() => { if (!canceled) setLoading(false); });
    return () => { canceled = true; };
  }, [reload, setUser]);
  useEffect(()=>{const signedOut=event=>{setUser(null);setMode('login');setPassword('');setError('');setBusy(false);setLoading(false);setSessionNotice(event.detail?.message||'Bạn đã được đăng xuất.');};window.addEventListener('account:signed-out',signedOut);return()=>window.removeEventListener('account:signed-out',signedOut);},[setUser]);
  async function submit(event) {
    event.preventDefault();
    if (busy || coolingDown) return;
    setBusy(true); setError(''); setSessionNotice(''); setRetryUntil(0);
    try {
      if (mode === 'register') {
        await authApi.register({ ho_ten: name, email, mat_khau: password });
        setMode('login'); notify({ message: 'Đăng ký thành công. Hãy đăng nhập bằng tài khoản vừa tạo.' });
      } else setUser(await authApi.login({ email, mat_khau: password }));
      setPassword('');
    } catch (failure) { showFailure(failure, 'Không kết nối được máy chủ. Vui lòng thử lại.'); }
    finally { setBusy(false); }
  }
  async function logout() {
    setBusy(true); setError(''); setSessionNotice('');
    try { await authApi.logout(); setUser(null); setPassword(''); notify({ message: 'Bạn đã đăng xuất.' }); }
    catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }
  async function admin() {
    setBusy(true); setError(''); setSessionNotice('');
    try { notify({ message: (await authApi.admin()).message }); }
    catch (failure) { setError(failure.message); if (failure.status === 401) setUser(null); }
    finally { setBusy(false); }
  }
  return <div className="account-page">
    <section className="account-intro"><span className="eyebrow">BOOKBID</span>
      <h1>Mỗi cuốn sách,<br/><em>một hành trình mới.</em></h1>
      <p className="intro">Tạo tài khoản để chuẩn bị tham gia cộng đồng đấu giá sách.</p>
      <div className="account-note">Tài khoản của bạn dùng chung cho hoạt động mua và bán sách.</div>
    </section>
    <section className="account-card" aria-label="Tài khoản">
      {loading ? <p role="status">Đang tải tài khoản…</p> : user ? <>
        <span className="eyebrow">TÀI KHOẢN CỦA BẠN</span><h2>Chào {user.ho_ten}</h2>
        <dl className="profile"><dt>Email</dt><dd>{user.email}</dd><dt>Vai trò</dt><dd>{user.vai_tro === 'admin' ? 'Quản trị viên' : 'Người dùng'}</dd>
          <dt>Ngày tham gia</dt><dd>{user.ngay_tao ? new Date(user.ngay_tao).toLocaleDateString('vi-VN') : '—'}</dd></dl>
        {user.vai_tro === 'admin' && <button className="primary" onClick={admin} disabled={busy}>Kiểm tra quyền quản trị</button>}
        <button className="secondary" onClick={logout} disabled={busy}>Đăng xuất</button>
        <button className="text-button" onClick={() => setReload(value => value + 1)} disabled={busy}>Tải lại thông tin tài khoản</button>
      </> : <>
        <div className="account-tabs"><button aria-pressed={mode === 'login'} disabled={busy} onClick={() => { setMode('login'); setPassword(''); setError(''); setSessionNotice(''); }}>Đăng nhập</button>
          <button aria-pressed={mode === 'register'} disabled={busy} onClick={() => { setMode('register'); setPassword(''); setError(''); setSessionNotice(''); }}>Đăng ký</button></div>
        <h2>{mode === 'register' ? 'Tạo tài khoản mới' : 'Chào mừng trở lại'}</h2>
        <form onSubmit={submit}>
          {mode === 'register' && <label>Họ và tên<input value={name} onChange={event => setName(event.target.value)} maxLength={100} autoComplete="name" required disabled={busy}/></label>}
          <label>Email<input type="email" value={email} onChange={event => setEmail(event.target.value)} maxLength={254} autoComplete="username" required disabled={busy}/></label>
          <label>Mật khẩu<input type="password" value={password} onChange={event => setPassword(event.target.value)} minLength={mode === 'register' ? 12 : 1} maxLength={128}
            autoComplete={mode === 'register' ? 'new-password' : 'current-password'} required disabled={busy}/></label>
          {mode === 'register' && <p className="field-hint">Sử dụng từ 12 đến 128 ký tự. Bạn có thể dùng một cụm từ dễ nhớ.</p>}
          <button className="primary" disabled={busy || coolingDown}>{busy ? 'Đang xử lý…' : coolingDown ? 'Vui lòng chờ…' : mode === 'register' ? 'Tạo tài khoản' : 'Đăng nhập'}</button>
        </form>
        <button className="text-button" onClick={() => setReload(value => value + 1)} disabled={busy}>Kiểm tra lại kết nối</button>
      </>}
      {retryUntil > 0 && <p className="notice" role="status">
        {coolingDown
          ? `Bạn đã thử quá nhiều lần. Có thể thử lại sau ${Math.floor(retrySeconds / 60)} phút ${retrySeconds % 60} giây.`
          : 'Đã hết thời gian chờ. Bạn có thể thử đăng nhập lại.'}
      </p>}
      {error && <p className="error" role="alert">{error}</p>}
      {sessionNotice && <p className="notice" role="status">{sessionNotice}</p>}
    </section>
  </div>;
}
