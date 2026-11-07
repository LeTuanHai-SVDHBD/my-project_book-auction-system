/** Chẩn đoán readiness an toàn: phân biệt API không tới được, HTTP sai và dependency chưa sẵn sàng. */
const serviceNames = ['sqlserver', 'redis', 'worker'];
const reasons = new Set(['DEPENDENCY_UNAVAILABLE', 'WORKER_NOT_RUNNING']);
export function smokeConnectionCode(error) {
  const codes = new Set(['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNRESET', 'EHOSTUNREACH']);
  for (const candidate of [error, error?.cause, ...(Array.isArray(error?.cause?.errors) ? error.cause.errors : [])]) {
    if (codes.has(candidate?.code)) return candidate.code;
  }
  return ['TimeoutError', 'AbortError'].includes(error?.name) ? 'TIMEOUT' : 'CONNECTION_FAILED';
}
function fail(message) {
  throw Object.assign(new Error(message), { smokeDiagnostic: true });
}
export async function checkSmokeReadiness({ base, fetchImpl = fetch }) {
  let response;
  try {
    response = await fetchImpl(base + '/health/ready', { signal: AbortSignal.timeout(15000) });
  } catch (error) {
    fail(`Không kết nối được HTTP API (${smokeConnectionCode(error)}). Giữ npm.cmd run dev:all chạy ở terminal thứ nhất; kiểm tra log [API] và API_HOST/API_PORT.`);
  }
  let health;
  try { health = await response.json(); } catch {
    fail(`API readiness trả HTTP ${response.status}, nội dung không phải JSON. Kiểm tra đúng cổng API và khởi động lại dev:all.`);
  }
  if (response.status === 200 && health?.ok === true && serviceNames.every(name => health.services?.[name]?.ok === true)) return;
  const services = serviceNames.map(name => {
    const value = health?.services?.[name];
    let detail = value?.ok === true ? 'OK' : 'CHƯA SẴN SÀNG';
    if (reasons.has(value?.reason)) detail += ` (${value.reason})`;
    if (name === 'sqlserver' && ['tables', 'columns', 'expectedTables', 'expectedColumns'].every(key => Number.isSafeInteger(value?.[key]))) {
      detail += `; bảng ${value.tables}/${value.expectedTables}, cột ${value.columns}/${value.expectedColumns}`;
    }
    return `${name}: ${detail}`;
  });
  fail(`API readiness HTTP ${response.status}; ${services.join('; ')}. Kiểm tra docker compose ps và log [API]/[WORKER]; worker thiếu heartbeat thì giữ dev:all chạy. SQL sai số bảng/cột thì kiểm tra đúng database và db:migrate.`);
}
