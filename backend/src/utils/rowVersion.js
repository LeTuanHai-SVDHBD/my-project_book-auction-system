/** Mã hóa rowversion SQL 8 byte thành 16 ký tự hex; không làm mất byte 0 đầu hoặc đổi sang Number. */
export function encodeRowVersion(value) {
  if (!(value instanceof Uint8Array) || value.byteLength !== 8) {
    throw new Error('SQL rowversion phải có đúng 8 byte nhị phân.');
  }
  return Buffer.from(value).toString('hex').toUpperCase();
}
export function withRowVersion(row) {
  return row ? { ...row, row_version: encodeRowVersion(row.row_version) } : row;
}
