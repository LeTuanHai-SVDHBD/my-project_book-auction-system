/**
 * Chuẩn hóa phản hồi lỗi HTTP và giới hạn thông tin lỗi nội bộ trả cho client.
 */
export class HttpError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}
export function errorHandler(log) {
  return (error, req, res, next) => {
    if (res.headersSent) return next(error);
    const status = error.type === 'entity.parse.failed' ? 400 : error.status || 500;
    if (status >= 500) log(error, { requestId: req.requestId });
    const publicMedia = error instanceof HttpError && error.publicMediaError === true;
    res.status(status).json({ error: status < 500 || publicMedia ? error.code || 'INVALID_REQUEST' : 'DEPENDENCY_UNAVAILABLE',
      message: status < 500 ? (status === 400 && error.type === 'entity.parse.failed' ? 'JSON không hợp lệ.' : error.message)
        : publicMedia ? error.message : 'Dịch vụ chưa sẵn sàng. Kiểm tra terminal API và Docker.', requestId: req.requestId });
  };
}
