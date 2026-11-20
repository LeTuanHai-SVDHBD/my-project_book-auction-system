/** Bộ lọc danh sách bài đăng của chủ sách, dùng chung cho giao diện và HTTP. */
export const OWNER_POST_FILTERS = Object.freeze([
  'all', 'pending', 'rejected', 'approved', 'scheduled', 'live', 'ended',
]);

// Liên kết lọc cũ tiếp tục mở được sau khi gộp hai nhóm hiển thị.
export const normalizeOwnerPostStatus = status => status === 'closing' ? 'ended' : status;
