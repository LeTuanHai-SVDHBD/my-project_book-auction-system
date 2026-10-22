export const INFRA = Object.freeze({ stream: 'bookauction:infra:requests', group: 'moc2-workers',
  deadLetter: 'bookauction:infra:dead-letter', heartbeat: 'bookauction:infra:worker',
  resultPrefix: 'bookauction:infra:probe:', resultTtl: 600, heartbeatTtl: 10,
  eventType: 'system.connection_probe', minIdleMs: 30000 });
export const isProbeId = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
