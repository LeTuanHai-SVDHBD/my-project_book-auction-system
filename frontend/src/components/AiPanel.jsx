import { STATUS } from "../utils/statusPresentation.js";
import StatusBadge from "./StatusBadge.jsx";
/** Kết quả hỗ trợ Admin: hai điểm độc lập, NULL có lý do, bằng chứng theo tiêu chí và lịch sử lần phân tích. */
import { useCallback, useEffect, useRef, useState } from "react";
import { apiRequest, apiPost } from "../services/authApi.js";
import { currentReview } from "../../../shared/aiVisibility.js";
import { aiProgressMessage } from "../utils/aiProgress.js";
const score = (value) =>
  value === null || value === undefined
    ? "Chưa đủ dữ liệu"
    : `${Number(value)} / 100`;
function Sources({ value }) {
  let refs;
  try {
    refs = JSON.parse(value);
  } catch {
    return value ? <p>Nguồn: {value}</p> : null;
  }
  return (
    <>
      {refs?.media?.length > 0 && (
        <p>Media đối chiếu: {refs.media.join(", ")}</p>
      )}
      {refs?.urls
        ?.filter((url) => typeof url === "string" && url.startsWith("https://"))
        .map((url) => (
          <p key={url}>
            <a href={url} target="_blank" rel="noreferrer">
              {url}
            </a>
          </p>
        ))}
    </>
  );
}
export default function AiPanel({ post, user }) {
  const admin = user?.vai_tro === "admin",
    visible = admin || Boolean(currentReview(post));
  const [data, setData] = useState(null),
    [selected, setSelected] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const sequence = useRef(0);
  const load = useCallback(
    async (analysisId = selected) => {
      const id = ++sequence.current;
      try {
        const result = await apiRequest(
          `/ai/${post.bai_dang_id}${analysisId ? `?analysis=${analysisId}` : ""}`,
        );
        if (id === sequence.current) {
          setData(result);
          setError("");
        }
      } catch (failure) {
        if (id === sequence.current)
          setError(
            admin
              ? failure.message
              : "Chưa tải được kết quả AI. Vui lòng tải lại trạng thái bài đăng.",
          );
      }
    },
    [post.bai_dang_id, selected, admin],
  );
  useEffect(() => {
    if (!visible) return;
    let stopped = false,
      timer;
    async function poll() {
      await load();
      if (!stopped && admin) timer = setTimeout(poll, 3000);
    }
    void poll();
    return () => {
      stopped = true;
      ++sequence.current;
      clearTimeout(timer);
    };
  }, [load, visible, admin]);
  async function request() {
    setBusy(true);
    setError("");
    try {
      const job = await apiPost(`/ai/${post.bai_dang_id}`, {
        row_version: post.row_version,
      });
      ++sequence.current;
      setData((previous) => ({
        ...previous,
        job: { ...job, source_version: post.row_version },
      }));
      setSelected("");
      await load("");
    } catch (failure) {
      if (failure.code === "AI_QUOTA_PAUSED") await load();
      else setError(failure.message);
    } finally {
      setBusy(false);
    }
  }
  const analysis = data?.analysis,
    pending = ["queued", "running"].includes(data?.job?.state),
    waiting = post.trang_thai_phien === "cho_kiem_duyet",
    quotaPaused = admin && waiting && Boolean(data?.quota_resume_at),
    canRetry = admin && waiting && data?.can_retry && !pending && !quotaPaused,
    hasScores = analysis && analysis.trang_thai !== "that_bai";
  if (!visible) return null;
  return (
    <section
      className="ai-review"
      aria-label={admin ? "Phân tích AI" : "Kết quả AI tham khảo"}
    >
      {admin && <h3>AI hỗ trợ kiểm duyệt</h3>}
      <p className="field-hint">
        Hệ thống đối chiếu hai điểm độc lập với mức đạt của từng nhóm.
      </p>
      {admin && waiting && data && !data.configured && (
        <p className="notice">AI chưa sẵn sàng. Bài đăng sẽ tiếp tục chờ.</p>
      )}
      {quotaPaused && (
        <p className="notice" role="status">
          <StatusBadge state="quota_paused" /> Gemini đã trả HTTP 429. Bài vẫn chờ kiểm duyệt. {" "}
          {data.quota_limited ? "Có thể yêu cầu phân tích lại từ " : "Hàng đợi sẽ tiếp tục từ "}
          <time dateTime={new Date(data.quota_resume_at).toISOString()}>
            {new Date(data.quota_resume_at).toLocaleString("vi-VN")}
          </time>.
        </p>
      )}
      {admin && waiting && !pending && !canRetry && !quotaPaused && data?.configured && (
        <p role="status"><StatusBadge state="queued" /> Hệ thống tự phân tích khi đến lượt.</p>
      )}
      {admin && pending && !quotaPaused && (
        <p className="notice" role="status">
          <StatusBadge state={data.job.state} /> {aiProgressMessage(data.job)}
          {analysis &&
            " Kết quả bên dưới thuộc lần phân tích trước; yêu cầu mới chưa hoàn tất."}
        </p>
      )}
      {canRetry && (
        <div>
          <p className="notice" role="status">
            {data.quota_limited
              ? "Lần phân tích trước dừng vì hạn mức Gemini. Hãy kiểm tra hạn mức trước khi yêu cầu phân tích lại."
              : "Chưa có quyết định cho hồ sơ này. Bạn có thể yêu cầu AI phân tích lại."}
          </p>
          <button className="primary" type="button" disabled={busy} onClick={request}>
            {busy ? "Đang gửi…" : "Phân tích lại bằng AI"}
          </button>
        </div>
      )}
      {admin && data?.history?.length > 0 && (
        <label className="ai-history-select">
          Lần phân tích
          <select
            aria-label="Lần phân tích"
            value={selected}
            onChange={(event) => setSelected(event.target.value)}
          >
            <option value="">Mới nhất</option>
            {data.history.map((row) => (
              <option key={row.phan_tich_id} value={row.phan_tich_id}>
                #{row.phan_tich_id} · {STATUS[row.trang_thai]?.label || STATUS.unknown.label} ·{" "}
                {new Date(row.ngay_phan_tich).toLocaleString("vi-VN")}
              </option>
            ))}
          </select>
        </label>
      )}
      {!data && !error && (
        <p role="status">
          {admin ? "Đang tải trạng thái AI…" : "Đang tải kết quả AI…"}
        </p>
      )}
      {!admin && !analysis && data && (
        <p role="status">Chưa có kết quả AI phù hợp cho lần kiểm duyệt này.</p>
      )}
      {analysis &&
        (!admin && analysis.trang_thai === "that_bai" ? (
          <p className="notice">
            AI chưa phân tích thành công. Vui lòng xem quyết định và lý do kiểm
            duyệt ở trên.
          </p>
        ) : (
          <>
            <p className="ai-analysis-meta">
              <StatusBadge state={analysis.trang_thai} /> {" "}
              {new Date(analysis.ngay_phan_tich).toLocaleString("vi-VN")}
            </p>
            {analysis.loi_thoi && (
              <p className="notice">
                Đây là phân tích của dữ liệu cũ hoặc chưa xác định được phiên
                bản đầu vào. Cần đối chiếu lại trước khi sử dụng.
              </p>
            )}
            {hasScores && (
              <div className="ai-score-grid">
                <div>
                  <h4>Hỗ trợ đánh giá độ hiếm</h4>
                  <strong>{score(analysis.diem_do_hiem)}</strong>
                  {analysis.tinh_diem?.do_hiem?.ly_do_null && <p>{analysis.tinh_diem.do_hiem.ly_do_null}</p>}
                </div>
                <div>
                  <h4>Tình trạng vật lý</h4>
                  <strong>{score(analysis.diem_tinh_trang)}</strong>
                  {analysis.tinh_diem?.tinh_trang?.ly_do_null && <p>{analysis.tinh_diem.tinh_trang.ly_do_null}</p>}
                </div>
              </div>
            )}
            {admin && analysis.thong_tin && (
              <p className="field-hint">
                Mô hình: {analysis.thong_tin.model} · Bộ quy tắc:{" "}
                {analysis.thong_tin.rule_version}
              </p>
            )}
            {admin && analysis.thong_tin?.execution && (
              <p className="field-hint">
                Đã gửi {analysis.thong_tin.execution.media_sent ?? 0}/
                {analysis.thong_tin.execution.media_total ?? 0} media · Gọi
                Gemini {analysis.thong_tin.execution.attempts ?? 0} lượt · Chuẩn
                bị media{" "}
                {Math.ceil((analysis.thong_tin.execution.media_ms ?? 0) / 1000)}{" "}
                giây · Giới hạn mỗi lượt{" "}
                {Math.ceil(
                  (analysis.thong_tin.execution.provider_timeout_ms ?? 0) /
                    1000,
                )}{" "}
                giây.
              </p>
            )}
            {admin && analysis.thong_tin?.error_code && (
              <p className="field-hint">
                Mã lỗi: {analysis.thong_tin.error_code}
                {analysis.thong_tin.provider_error?.http_status
                  ? ` · HTTP ${analysis.thong_tin.provider_error.http_status}`
                  : ""}
                {analysis.thong_tin.provider_error?.provider_code
                  ? ` · ${analysis.thong_tin.provider_error.provider_code}`
                  : ""}
                {analysis.thong_tin.provider_error?.transport_code
                  ? ` · ${analysis.thong_tin.provider_error.transport_code}`
                  : ""}
              </p>
            )}
            {analysis.thong_tin?.warnings?.map((text, index) => (
              <p className="notice" key={index}>
                {text}
              </p>
            ))}
            {analysis.chi_tiet?.map((row, index) => (
              <details key={index} className="ai-criterion">
                <summary>
                  {row.tieu_chi} · {row.trang_thai_danh_gia} ·{" "}
                  {row.diem === null ? "Chưa chấm" : `${row.diem} điểm`} · Trọng
                  số {row.trong_so}%
                </summary>
                <p className="preserve-lines">
                  {row.bang_chung || "Chưa có bằng chứng đủ để đánh giá."}
                </p>
                <Sources value={row.nguon_doi_chieu} />
                {row.canh_bao && <p className="notice">{row.canh_bao}</p>}
                {row.do_tin_cay !== null && (
                  <p className="field-hint">
                    Độ tin cậy do AI báo cáo: {row.do_tin_cay}% — không dùng để
                    xác thực nguồn.
                  </p>
                )}
              </details>
            ))}
            {analysis.tinh_diem && (
              <details>
                <summary>Đối chiếu phép tính</summary>
                <p>
                  Điểm tổng = Σ(điểm thành phần × trọng số) / Σtrọng số áp dụng.
                  Thiếu một tiêu chí áp dụng thì giữ NULL.
                </p>
                {Object.entries(analysis.tinh_diem).map(([key, item]) => (
                  <p key={key}>
                    {key === "do_hiem" ? "Độ hiếm" : "Tình trạng"}:{" "}
                    {item.diem === null
                      ? item.ly_do_null
                      : `${item.tong_diem_co_trong_so} / ${item.tong_trong_so_ap_dung} = ${Number(item.diem.toFixed(2))}`}
                  </p>
                ))}
              </details>
            )}
            {analysis.thong_tin?.media?.length > 0 && (
              <details>
                <summary>Dữ liệu media đã dùng</summary>
                {analysis.thong_tin.media.map((row) => (
                  <p key={row.id}>
                    <a href={row.url} target="_blank" rel="noreferrer">
                      {row.id}
                    </a>{" "}
                    · {row.sent ? "Đã gửi cho AI" : "Chưa phân tích"}
                    {row.input_method === "files_api" &&
                      " · Files API · Toàn bộ tệp video (Gemini lấy mẫu)"}
                    {Number.isFinite(row.duration_seconds) &&
                      ` · ${Math.floor(row.duration_seconds / 60)} phút ${Math.floor(row.duration_seconds % 60)} giây`}
                    {Number.isFinite(row.bytes) &&
                      ` · ${(row.bytes / 1048576).toFixed(1)} MB`}
                  </p>
                ))}
              </details>
            )}
          </>
        ))}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {!admin && error && (
        <button type="button" className="secondary" onClick={() => load("")}>
          Tải lại kết quả AI
        </button>
      )}
    </section>
  );
}
