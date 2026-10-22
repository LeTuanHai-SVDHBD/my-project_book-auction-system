/**
 * Tổng hợp readiness của SQL Server, Redis và worker; thiếu thành phần thì báo chưa sẵn sàng.
 */
export async function readiness(deps) {
  const names = ['sqlserver', 'redis', 'worker'];
  const results = await Promise.allSettled(names.map(name => Promise.resolve().then(() => deps[name]())));
  const services = Object.fromEntries(results.map((result, i) => [names[i], result.status === 'fulfilled'
    ? result.value : { ok: false, reason: 'DEPENDENCY_UNAVAILABLE' }]));
  return { ok: names.every(name => services[name]?.ok === true), api: { ok: true }, services, checkedAt: new Date().toISOString() };
}
