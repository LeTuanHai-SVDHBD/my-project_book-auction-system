/**
 * Màn hình kiểm tra môi trường Mốc 2.
 * Hiển thị trạng thái dịch vụ và gửi probe kiểm tra hạ tầng.
 */
import {browserApiBase} from '../services/apiBase.js';
import { useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
const base=browserApiBase();
function Status({ label, value, detail }) {
  const status = value === undefined ? 'waiting' : value ? 'ready' : 'down';
  return <article className={`service ${status}`}><div className="service-top"><span className="dot"/><span>{label}</span></div>
    <strong>{value === undefined ? 'Đang kiểm tra' : value ? 'Sẵn sàng' : 'Chưa sẵn sàng'}</strong><p>{detail}</p></article>;
}
export default function InfrastructurePanel() {
  const [health, setHealth] = useState(null); const [networkError, setNetworkError] = useState('');
  const [socketReady, setSocketReady] = useState(false); const [token, setToken] = useState('');
  const [result, setResult] = useState(null); const [probeError, setProbeError] = useState(''); const [busy, setBusy] = useState(false);
  const mounted = useRef(true);
  const refresh = useCallback(async () => {
    try { const response = await fetch(`${base}/api/health/ready`, { signal: AbortSignal.timeout(8000) });
      const body = await response.json(); if (mounted.current) { setHealth(body); setNetworkError(''); }
    } catch { if (mounted.current) { setHealth(null); setNetworkError('Chưa gọi được API. Kiểm tra terminal npm run dev:api.'); } }
  }, []);
  useEffect(() => {
    mounted.current = true; let timer; let canceled = false;
    async function tick() { await refresh(); if (!canceled) timer = setTimeout(tick, 5000); } tick();
    const socket = io(base, { autoConnect: true, timeout: 5000 });
    socket.on('system:hello', () => setSocketReady(true)); socket.on('disconnect', () => setSocketReady(false)); socket.on('connect_error', () => setSocketReady(false));
    return () => { mounted.current = false; canceled = true; clearTimeout(timer); socket.disconnect(); };
  }, [refresh]);
  async function probe() {
    setBusy(true); setProbeError(''); setResult(null);
    try {
      const headers = { 'x-dev-token': token.trim(), 'Content-Type': 'application/json' };
      const response = await fetch(`${base}/api/dev/probes`, { method: 'POST', headers, body: '{}', signal: AbortSignal.timeout(8000) });
      const body = await response.json(); if (!response.ok) throw new Error(body.message || 'Không gửi được yêu cầu.');
      setResult(body);
      for (let n = 0; n < 25; n++) {
        await new Promise(resolve => setTimeout(resolve, 1500)); if (!mounted.current) return;
        const reply = await fetch(`${base}/api/dev/probes/${body.requestId}`, { headers, signal: AbortSignal.timeout(8000) });
        const value = await reply.json(); if (!reply.ok) throw new Error(value.message || 'Không đọc được kết quả.');
        setResult(value); if (value.status === 'completed') { await refresh(); return; }
      }
      throw new Error('Yêu cầu còn chờ. Kiểm tra terminal worker rồi thử lại.');
    } catch (error) { if (mounted.current) setProbeError(error.message); }
    finally { if (mounted.current) setBusy(false); }
  }
  const db = health?.services?.sqlserver; const redis = health?.services?.redis; const worker = health?.services?.worker;
  return <div className="page"><header><a className="brand" href="#"><span className="mark">B</span> BookAuction <span className="tag">NHÓM 15</span></a><span className="stage">KIỂM TRA HỆ THỐNG</span></header>
    <main><div className="eyebrow">NỀN TẢNG CHO HỆ THỐNG ĐẤU GIÁ SÁCH</div><h1>Kết nối trước.<br/><em>Triển khai từng bước.</em></h1>
      <p className="intro">Kiểm tra giao diện, API, cơ sở dữ liệu và tiến trình xử lý nền trong cùng một nơi.</p>
      <div className="summary"><span className={`dot ${health?.ok ? 'green' : 'amber'}`}/><b>{health?.ok ? 'Các thành phần đã sẵn sàng' : 'Đang chờ đủ các thành phần'}</b><button onClick={refresh}>Kiểm tra lại ↗</button></div>
      {networkError && <p className="alert" role="alert">{networkError}</p>}
      <section className="services" aria-label="Trạng thái hạ tầng">
        <Status label="Express API" value={health ? true : networkError ? false : undefined} detail="Tiếp nhận yêu cầu · cổng 5000"/>
        <Status label="SQL Server" value={db?.ok} detail={db?.connected ? `${db.databaseName} · ${db.tables}/${db.expectedTables ?? 20} bảng · ${db.columns}/${db.expectedColumns ?? 152} trường` : 'Kho dữ liệu chính · cổng 14330'}/>
        <Status label="Redis" value={redis?.ok} detail="Redis Streams · cổng 63790"/>
        <Status label="Event Worker" value={worker?.ok} detail={worker?.consumer || 'Tiến trình Node.js chạy riêng'}/>
        <Status label="Socket.IO" value={socketReady} detail="Kiểm tra kết nối thời gian thực"/>
      </section>
      <section className="probe"><div className="probe-copy"><span className="eyebrow">KIỂM TRA ĐƯỜNG ĐI SỰ KIỆN</span><h2>Một yêu cầu, qua đủ các thành phần.</h2>
        <p>React gửi yêu cầu → API đưa vào Redis Streams → worker đọc và truy vấn SQL Server → giao diện lấy kết quả.</p>
        <p className="muted">Luồng này kiểm tra hạ tầng. Đặt giá, lịch sử và kết quả được theo dõi trong Danh mục.</p></div>
        <div className="probe-form"><label htmlFor="token">Khóa kiểm tra cục bộ</label><input id="token" type="password" value={token} onChange={e => setToken(e.target.value)} placeholder="DEV_PROBE_TOKEN trong .env" autoComplete="off"/>
          <button className="primary" disabled={busy || !token.trim()} onClick={probe}>{busy ? 'Đang kiểm tra…' : 'Gửi sự kiện kiểm tra →'}</button>
          {probeError && <p className="error" role="alert">{probeError}</p>}
          {result && <div className={`result ${result.status === 'completed' ? 'done' : ''}`}><b>{result.status === 'completed' ? '✓ Worker đã đọc được SQL Server' : 'Yêu cầu đã xếp hàng'}</b><code>{result.requestId}</code>{result.consumer && <small>Worker: {result.consumer}</small>}</div>}
        </div></section>
      <footer><span>React + Express + SQL Server + Redis</span><span>{health?.checkedAt ? `Cập nhật ${new Date(health.checkedAt).toLocaleTimeString('vi-VN')}` : 'Tự kiểm tra mỗi 5 giây'}</span></footer>
    </main></div>;
}
