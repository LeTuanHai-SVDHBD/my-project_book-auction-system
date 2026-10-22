export class HttpError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}
export function errorHandler(log) {
  return (error, req, res, next) => {
    if (res.headersSent) return next(error);
    const status = error.type === 'entity.parse.failed' ? 400 : error.status || 500;
    if (status >= 500) log(error, { requestId: req.requestId });
    res.status(status).json({ error: status < 500 ? error.code || 'INVALID_REQUEST' : 'DEPENDENCY_UNAVAILABLE',
      message: status < 500 ? (status === 400 && error.type === 'entity.parse.failed' ? 'JSON không hợp lệ.' : error.message)
        : 'Dịch vụ chưa sẵn sàng. Kiểm tra terminal API và Docker.', requestId: req.requestId });
  };
}
