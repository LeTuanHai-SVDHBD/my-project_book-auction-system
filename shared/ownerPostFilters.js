/** Bộ lọc danh sách bài đăng của chủ sách, dùng chung cho giao diện và HTTP. */
export const OWNER_POST_FILTERS = Object.freeze([
  'all', 'pending', 'rejected', 'approved', 'scheduled', 'live', 'closing', 'ended',
]);
