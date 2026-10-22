/** Truy cập NguoiDung bằng tham số SQL; không tự thay vai trò tài khoản đã có. */
export function createUserModel({ getPool, sql }) {
  const safeColumns = 'nguoi_dung_id, ho_ten, email, so_dien_thoai, dia_chi, anh_dai_dien, anh_bia, vai_tro, ngay_tao';
  return {
    async findByEmail(email) {
      const pool = await getPool();
      const result = await pool.request().input('email', sql.VarChar(254), email)
        .query(`SELECT ${safeColumns}, mat_khau FROM dbo.NguoiDung WHERE email = @email`);
      return result.recordset[0] || null;
    },
    async findById(id) {
      const pool = await getPool();
      const result = await pool.request().input('id', sql.Int, id)
        .query(`SELECT ${safeColumns} FROM dbo.NguoiDung WHERE nguoi_dung_id = @id`);
      return result.recordset[0] || null;
    },
    async create({ ho_ten, email, passwordHash, role = 'nguoi_dung' }) {
      const pool = await getPool();
      try {
        const result = await pool.request().input('name', sql.NVarChar(100), ho_ten)
          .input('email', sql.VarChar(254), email).input('hash', sql.VarChar(255), passwordHash)
          .input('role', sql.VarChar(20), role)
          .query(`INSERT INTO dbo.NguoiDung (ho_ten, email, mat_khau, vai_tro)
            OUTPUT INSERTED.nguoi_dung_id VALUES (@name, @email, @hash, @role)`);
        return this.findById(result.recordset[0].nguoi_dung_id);
      } catch (error) {
        // UNIQUE bảo vệ cả hai request đăng ký trùng chạy đồng thời.
        if ([2601, 2627].includes(error.number)) {
          const duplicate = new Error('Email đã được sử dụng.'); duplicate.code = 'EMAIL_EXISTS'; throw duplicate;
        }
        throw error;
      }
    },
  };
}
