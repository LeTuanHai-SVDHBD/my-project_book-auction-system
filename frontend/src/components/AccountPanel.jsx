/** Đăng ký, đăng nhập và thông tin tài khoản; không lưu xác thực vào storage. */
import { useEffect, useState } from 'react';
import { authApi } from '../services/authApi.js';
export default function AccountPanel() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let canceled = false;
    setLoading(true); setError('');
    authApi.current().then(value => { if (!canceled) setUser(value); })
      .catch(() => { if (!canceled) setError('Chưa tải được tài khoản. Kiểm tra API và Redis rồi thử lại.'); })
      .finally(() => { if (!canceled) setLoading(false); });
    return () => { canceled = true; };
  }, [reload]);
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      if (mode === 'register') {
        await authApi.register({ ho_ten: name, email, mat_khau: password });
        setMode('login'); setMessage('Đăng ký thành công. Hãy đăng nhập bằng tài khoản vừa tạo.');
      } else setUser(await authApi.login({ email, mat_khau: password }));
      setPassword('');
    } catch (failure) { setError(failure.message || 'Không kết nối được máy chủ. Vui lòng thử lại.'); }
    finally { setBusy(false); }
  }
  async function logout() {
    setBusy(true); setError(''); setMessage('');
    try { await authApi.logout(); setUser(null); setPassword(''); setMessage('Bạn đã đăng xuất.'); }
    catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }
  async function admin() {
    setBusy(true); setError(''); setMessage('');
    try { setMessage((await authApi.admin()).message); }
    catch (failure) { setError(failure.message); if (failure.status === 401) setUser(null); }
    finally { setBusy(false); }
  }
  return <div className="account-page">
    <section className="account-intro"><span className="eyebrow">BOOKAUCTION · NHÓM 15</span>
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
        <div className="account-tabs"><button aria-pressed={mode === 'login'} disabled={busy} onClick={() => { setMode('login'); setPassword(''); setError(''); setMessage(''); }}>Đăng nhập</button>
          <button aria-pressed={mode === 'register'} disabled={busy} onClick={() => { setMode('register'); setPassword(''); setError(''); setMessage(''); }}>Đăng ký</button></div>
        <h2>{mode === 'register' ? 'Tạo tài khoản mới' : 'Chào mừng trở lại'}</h2>
        <form onSubmit={submit}>
          {mode === 'register' && <label>Họ và tên<input value={name} onChange={event => setName(event.target.value)} maxLength={100} autoComplete="name" required disabled={busy}/></label>}
          <label>Email<input type="email" value={email} onChange={event => setEmail(event.target.value)} maxLength={254} autoComplete="username" required disabled={busy}/></label>
          <label>Mật khẩu<input type="password" value={password} onChange={event => setPassword(event.target.value)} minLength={mode === 'register' ? 12 : 1} maxLength={128}
            autoComplete={mode === 'register' ? 'new-password' : 'current-password'} required disabled={busy}/></label>
          {mode === 'register' && <p className="field-hint">Sử dụng từ 12 đến 128 ký tự. Bạn có thể dùng một cụm từ dễ nhớ.</p>}
          <button className="primary" disabled={busy}>{busy ? 'Đang xử lý…' : mode === 'register' ? 'Tạo tài khoản' : 'Đăng nhập'}</button>
        </form>
        <button className="text-button" onClick={() => setReload(value => value + 1)} disabled={busy}>Kiểm tra lại kết nối</button>
      </>}
      {error && <p className="error" role="alert">{error}</p>}
      {message && <p className="account-success" role="status">{message}</p>}
    </section>
  </div>;
}
