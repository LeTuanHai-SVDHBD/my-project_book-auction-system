/** Chỉ người bán xuất quyết định đã lưu; cửa sổ in mở từ thao tác nhấn để tránh popup blocker. */
import { useState } from "react";
import { postApi } from "../services/postApi.js";
import {
  openReviewWindow,
  printReviewDocument,
} from "../services/reviewDocument.js";

export default function ReviewExportButton({ postId, review }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function exportResult() {
    setError("");
    let popup;
    try {
      popup = openReviewWindow();
      setBusy(true);
      const report = await postApi.exportReview(postId, review.kiem_duyet_id);
      await printReviewDocument(popup, report);
    } catch (failure) {
      if (popup && !popup.closed) popup.close();
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="review-export">
      <button
        type="button"
        className="secondary"
        disabled={busy}
        onClick={exportResult}
      >
        {busy ? "Đang chuẩn bị kết quả…" : "Xuất kết quả kiểm duyệt (PDF)"}
      </button>
      <p className="field-hint">
        Chọn “Lưu dưới dạng PDF” trong hộp thoại in. Ảnh/video được đính kèm
        bằng liên kết Cloudinary.
      </p>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </div>
  );
}
