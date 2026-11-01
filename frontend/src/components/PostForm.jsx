/** Biểu mẫu sách/bài đăng; tệp được tải trước, chỉ vé upload được gửi cùng nội dung. */
import { mediaDisplayUrl } from "../../../shared/mediaDelivery.js";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { openPostDraft } from "../services/postDrafts.js";
import { mediaAccept } from "../../../shared/mediaFormats.js";
import { postApi } from "../services/postApi.js";
import UploadMediaCard from "./UploadMediaCard.jsx";
import MoneyInput from "./MoneyInput.jsx";
import GenreSelect from "./GenreSelect.jsx";
import { ISBN_MAX_LENGTH } from "../../../shared/bookIdentifiers.js";
export default function PostForm({
  source,
  owner,
  mode = "create",
  onSaved,
  onCancel,
}) {
  const [draft] = useState(() => openPostDraft({ owner, mode, source }));
  useSyncExternalStore(draft.subscribe, draft.snapshot);
  const initial = useRef({ ...source, ...draft.data.fields }).current;
  const [step, setStep] = useState(draft.data.step),
    [review, setReview] = useState(draft.data.fields);
  const formRef = useRef(null);
  const [isbnMode, setIsbnMode] = useState(draft.data.isbnMode),
    [isbn, setIsbn] = useState(draft.data.isbn);
  const [config, setConfig] = useState(null);
  const media = draft.data.media;
  const [removed, setRemoved] = useState(draft.data.removed);
  const [editRevision, setEditRevision] = useState(0),
    [confirmDiscard, setConfirmDiscard] = useState(false);
  const editableBook = mode === "create" || mode === "resubmit";
  const keptMedia = (source?.media || []).filter(
    (item) => !removed.some((x) => x.id === item.id && x.kind === item.kind),
  );
  function stageRemoval(item) {
    setRemoved((old) => [...old, { id: item.id, kind: item.kind }]);
    setError("");
  }
  function undoRemoval(item) {
    if (
      item.kind === "video" &&
      keptMedia.filter((x) => x.kind === "video").length +
        media.filter((x) => x.kind === "video").length >=
        (config?.maxVideos ?? 3)
    ) {
      setError(
        "Không thể giữ lại video này vì đã đủ giới hạn video. Hãy bỏ video mới hoặc video khác trước.",
      );
      return;
    }
    setRemoved((old) =>
      old.filter((x) => x.id !== item.id || x.kind !== item.kind),
    );
    setError("");
  }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(() =>
    String(initial.thoi_gian_cho_dat_lai ?? 20),
  );
  const requestId = draft.data.requestId;
  const uploading = draft.status.busy,
    locked = busy || uploading;
  useLayoutEffect(() => {
    if (formRef.current && !busy) {
      const fields = Object.fromEntries(new FormData(formRef.current));
      if (mode === "relist")
        fields.reuse_media = formRef.current.elements.reuse_media.checked
          ? "on"
          : "off";
      draft.save({ fields, step, isbnMode, isbn, removed });
    }
  }, [draft, step, isbnMode, isbn, cooldown, removed, editRevision, busy]);
  useEffect(() => {
    let canceled = false;
    postApi
      .config()
      .then((value) => {
        if (!canceled) setConfig(value);
      })
      .catch((failure) => {
        if (!canceled) setError(failure.message);
      });
    return () => {
      canceled = true;
    };
  }, []);
  function upload(event) {
    const files = [...event.target.files];
    event.target.value = "";
    setError("");
    const reused =
      mode === "resubmit" ||
      (mode === "relist" && formRef.current?.elements.reuse_media?.checked);
    void draft.upload(
      files,
      config,
      reused ? keptMedia.filter((x) => x.kind === "video").length : 0,
    );
  }
  function remove(item) {
    setError("");
    void draft.remove(item);
  }
  async function submit(event) {
    event.preventDefault();
    if (locked) return;
    if (step < 3) {
      next();
      return;
    }
    const invalid = [
      ...event.currentTarget.querySelectorAll("input,textarea,select"),
    ].find((el) => !el.checkValidity());
    if (invalid) {
      setStep(Number(invalid.closest("[data-step]")?.dataset.step || 0));
      setError("Vui lòng kiểm tra thông tin còn thiếu.");
      return;
    }
    if (draft.pruneExpired()) return;
    const data = Object.fromEntries(new FormData(event.currentTarget));
    setBusy(true);
    setError("");
    const body = {
      ma_yeu_cau: requestId,
      bai_dang: {
        tieu_de: data.tieu_de,
        mo_ta_tinh_trang: data.mo_ta_tinh_trang,
      },
      phien: {
        gia_khoi_diem: data.gia_khoi_diem,
        gia_toi_thieu: data.gia_toi_thieu,
        buoc_gia: data.buoc_gia,
        thoi_gian_cho_dat_lai: Number(data.thoi_gian_cho_dat_lai),
      },
      media: media.map(({ upload_id, tieu_de }) => ({ upload_id, tieu_de })),
    };
    if (editableBook)
      body.sach = Object.fromEntries(
        ["ten_sach", "tac_gia", "the_loai", "nha_xuat_ban", "isbn", "mo_ta"]
          .map((key) => [key, data[key] || null])
          .concat([
            [
              "nam_xuat_ban",
              data.nam_xuat_ban ? Number(data.nam_xuat_ban) : null,
            ],
          ]),
      );
    if (mode !== "create") {
      body.reuse_media = mode === "resubmit" || data.reuse_media === "on";
      if (mode === "resubmit") {
        delete body.ma_yeu_cau;
        body.row_version = source.row_version;
        body.remove_media = removed;
      }
    }
    try {
      const result = await postApi.save(body, source?.bai_dang_id, mode);
      draft.clear({ submitted: true });
      onSaved(result.id);
    } catch (failure) {
      setError(
        failure.message +
          (failure.status === 409
            ? " Đóng biểu mẫu và tải lại bài nếu trạng thái đã thay đổi."
            : ""),
      );
    } finally {
      setBusy(false);
    }
  }
  function next() {
    const fields = formRef.current.querySelector(`[data-step="${step}"]`);
    const invalid = [...fields.querySelectorAll("input,textarea,select")].find(
      (el) => !el.checkValidity(),
    );
    if (invalid) {
      invalid.reportValidity();
      return;
    }
    setReview(Object.fromEntries(new FormData(formRef.current)));
    setError("");
    setStep((value) => Math.min(3, value + 1));
  }
  const input = (
    name,
    label,
    max,
    required = false,
    type = "text",
    value = initial[name] ?? "",
  ) => (
    <label key={name}>
      {label}
      <input
        name={name}
        type={type}
        defaultValue={value}
        maxLength={max}
        required={required}
      />
    </label>
  );
  return (
    <section className="post-sheet">
      <span className="eyebrow">CHỦ SÁCH</span>
      <h2>
        {mode === "create"
          ? "Đăng sách mới"
          : mode === "resubmit"
            ? "Bổ sung và gửi duyệt lại"
            : "Đăng lại cùng bản sách"}
      </h2>
      <ol className="live-form-steps">
        {[
          "Thông tin sách",
          "Ảnh và video",
          "Thông số đấu giá",
          "Kiểm tra và gửi",
        ].map((label, index) => (
          <li key={label} aria-current={step === index ? "step" : undefined}>
            <span>{index + 1}</span>
            {label}
          </li>
        ))}
      </ol>
      <aside className="post-draft-status" aria-label="Bản nháp đăng sách">
        <div>
          <strong>Bản nháp riêng của bạn</strong>
          <p>
            {draft.status.storageError ||
              "Tự động lưu trên trình duyệt này. Đóng biểu mẫu hoặc chuyển trang vẫn giữ nội dung."}
          </p>
          <small>
            Tệp chưa gửi bài có hạn giữ 1 giờ từ lúc bắt đầu tải. Khi tải lại
            trang/đóng trình duyệt, lượt tải đang chạy có thể bị gián đoạn.
          </small>
        </div>
        <button
          type="button"
          className="secondary"
          onClick={() => setConfirmDiscard(true)}
          disabled={busy}
        >
          Bỏ bản nháp
        </button>
      </aside>
      {draft.status.notice && (
        <p className="notice" role="status">
          {draft.status.notice}
        </p>
      )}
      {confirmDiscard && (
        <div className="notice">
          <p>
            Xóa nội dung nháp và bỏ các tệp mới? Hồ sơ đã lưu trước đó được giữ
            nguyên.
          </p>
          <div className="actions">
            <button
              type="button"
              onClick={() => {
                draft.clear();
                onCancel();
              }}
            >
              Xóa bản nháp
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => setConfirmDiscard(false)}
            >
              Giữ bản nháp
            </button>
          </div>
        </div>
      )}
      <form
        ref={formRef}
        noValidate
        onSubmit={submit}
        onChange={() => setEditRevision((v) => v + 1)}
      >
        <fieldset disabled={busy}>
          <div data-step="0" hidden={step !== 0}>
            {editableBook ? (
              <>
                <h3>Thông tin bản sách</h3>
                <div className="form-grid">
                  {input("ten_sach", "Tên sách", 300, true)}
                  {input("tac_gia", "Tác giả", 200)}
                  <GenreSelect
                    initialValue={initial.the_loai || ""}
                    onValueChange={() => setEditRevision((v) => v + 1)}
                  />
                  {input("nha_xuat_ban", "Nhà xuất bản", 200)}
                  {input("nam_xuat_ban", "Năm xuất bản", 4, false, "number")}
                  <div className="isbn-field">
                    <fieldset className="isbn-choice">
                      <legend>ISBN</legend>
                      <div role="radiogroup" aria-label="Thông tin ISBN">
                        <label>
                          <input
                            type="radio"
                            name="isbn_option"
                            value="has"
                            checked={isbnMode === "has"}
                            onChange={() => setIsbnMode("has")}
                          />
                          Có ISBN
                        </label>
                        <label>
                          <input
                            type="radio"
                            name="isbn_option"
                            value="none"
                            checked={isbnMode === "none"}
                            onChange={() => setIsbnMode("none")}
                          />
                          Không có ISBN
                        </label>
                      </div>
                    </fieldset>
                    {isbnMode === "has" ? (
                      <label>
                        Mã ISBN
                        <input
                          name="isbn"
                          aria-label="Mã ISBN"
                          value={isbn}
                          onChange={(event) => setIsbn(event.target.value)}
                          maxLength={ISBN_MAX_LENGTH}
                          required
                          autoComplete="off"
                        />
                        <small className="field-hint">
                          Nhập theo thông tin trên sách, có thể giữ dấu gạch nối
                          và khoảng trắng. Tối đa {ISBN_MAX_LENGTH} ký tự; Admin
                          sẽ đối chiếu mã khi kiểm duyệt.
                        </small>
                      </label>
                    ) : (
                      <p className="field-hint">
                        Sách cổ hoặc bản sách không có mã ISBN vẫn có thể gửi
                        kiểm duyệt.
                      </p>
                    )}
                  </div>
                </div>
                <label>
                  Giới thiệu sách
                  <textarea
                    name="mo_ta"
                    aria-label="Giới thiệu sách"
                    maxLength={12000}
                    defaultValue={initial.mo_ta || ""}
                  />
                </label>
              </>
            ) : (
              <p>
                Giữ sách #{source.sach_id}: <strong>{source.ten_sach}</strong>.{" "}
                {mode === "relist"
                  ? "Tạo bài và phiên mới, giữ nguyên lịch sử phiên cũ."
                  : "Giữ bài, phiên, media và lịch sử kiểm duyệt; bổ sung bằng chứng còn thiếu."}
              </p>
            )}
            <h3>Nội dung gửi kiểm duyệt</h3>
            {input("tieu_de", "Tiêu đề bài đăng", 300, true)}
            <label>
              Tình trạng, yếu tố quý hiếm và bằng chứng
              <textarea
                name="mo_ta_tinh_trang"
                aria-label="Tình trạng, yếu tố quý hiếm và bằng chứng"
                defaultValue={initial.mo_ta_tinh_trang || ""}
                required
                maxLength={12000}
                rows={7}
                aria-describedby="book-review-hint"
              />
            </label>
            <p className="field-hint" id="book-review-hint">
              Mô tả tình trạng bìa, gáy, trang giấy và các hư hỏng nếu có; nêu
              đặc điểm quý hiếm như bản in đầu, chữ ký, số lượng giới hạn… và
              chỉ rõ ảnh/video minh chứng. Nếu không biết thông tin nào, hãy ghi
              rõ chưa xác định.
            </p>
          </div>
          <div data-step="1" hidden={step !== 1}>
            <h3>Ảnh và video</h3>
            {mode === "relist" && (
              <label className="check-label">
                <input
                  type="checkbox"
                  name="reuse_media"
                  defaultChecked={
                    initial.reuse_media !== undefined
                      ? initial.reuse_media === "on"
                      : true
                  }
                  disabled={uploading}
                />
                Dùng lại media của bài cũ
              </label>
            )}
            <p className="field-hint">
              {config
                ? `Không giới hạn số lượng ảnh (${config.imageMaxBytes / 1048576} MB/ảnh). Tối đa ${config.maxVideos} video (${config.videoMaxBytes / 1048576} MB/video). ${config.formatLabel}.`
                : "Đang tải cấu hình…"}
            </p>
            {config && !config.configured && (
              <p className="notice">
                Chức năng tải tệp chưa sẵn sàng. Vui lòng liên hệ quản trị viên.
              </p>
            )}
            <label>
              Chọn tệp
              <input
                type="file"
                multiple
                accept={config?.accept || mediaAccept}
                disabled={!config?.configured || locked}
                onChange={upload}
              />
            </label>
            {media.length > 0 && (
              <div className="media-selection-summary">
                <strong>
                  {media.filter((item) => item.kind === "image").length} ảnh ·{" "}
                  {media.filter((item) => item.kind === "video").length} video
                  vừa tải lên
                </strong>
                <span>Nhấn × trên tệp để bỏ trước khi gửi bài.</span>
              </div>
            )}
            <div className="media-grid upload-selection">
              {media.map((item) => (
                <UploadMediaCard
                  key={item.upload_id}
                  item={item}
                  onRemove={remove}
                  disabled={locked}
                />
              ))}
            </div>
            {source?.media?.length > 0 && (
              <>
                <h4>Media đã gắn với bản sách</h4>
                <p className="field-hint">
                  {mode === "resubmit"
                    ? "Nhấn × để gỡ khỏi hồ sơ gửi duyệt mới. Chỉ áp dụng khi gửi thành công; bản nháp giữ các thay đổi này; dữ liệu cũ và file Cloudinary chỉ thay đổi khi gửi thành công."
                    : "Media đã lưu của bài nguồn được giữ nguyên cùng lịch sử."}
                </p>
                <div className="media-grid">
                  {keptMedia.map((item) =>
                    mode === "resubmit" ? (
                      <UploadMediaCard
                        key={`${item.kind}:${item.id}`}
                        item={item}
                        disabled={locked || !item.id}
                        onRemove={stageRemoval}
                        removeTitle="Gỡ khỏi hồ sơ gửi duyệt mới"
                      />
                    ) : (
                      <figure key={item.url}>
                        {item.kind === "image" ? (
                          <img
                            src={mediaDisplayUrl(item.url, item.kind)}
                            alt={item.title || "Ảnh sách"}
                          />
                        ) : (
                          <video
                            src={mediaDisplayUrl(item.url, item.kind)}
                            controls
                            preload="metadata"
                          />
                        )}
                        <figcaption>{item.title}</figcaption>
                      </figure>
                    ),
                  )}
                </div>
                {mode === "resubmit" && removed.length > 0 && (
                  <div className="notice" aria-label="Media dự kiến gỡ">
                    <strong>
                      {removed.length} tệp sẽ được gỡ khỏi hồ sơ mới
                    </strong>
                    {source.media
                      .filter((item) =>
                        removed.some(
                          (x) => x.kind === item.kind && x.id === item.id,
                        ),
                      )
                      .map((item) => (
                        <p key={`${item.kind}:${item.id}`}>
                          {item.title ||
                            (item.kind === "video"
                              ? "Video bản sách"
                              : "Ảnh bản sách")}{" "}
                          ·{" "}
                          <button
                            type="button"
                            className="text-button"
                            onClick={() => undoRemoval(item)}
                          >
                            Giữ lại{" "}
                            {item.title ||
                              (item.kind === "video" ? "video" : "ảnh")}
                          </button>
                        </p>
                      ))}
                  </div>
                )}
              </>
            )}
          </div>
          <div data-step="2" hidden={step !== 2}>
            <h3>Thông số đấu giá</h3>
            <div className="form-grid">
              <MoneyInput
                name="gia_khoi_diem"
                label="Giá khởi điểm (VND)"
                initialValue={initial.gia_khoi_diem}
              />
              <MoneyInput
                name="gia_toi_thieu"
                label="Giá kết thúc sớm — chỉ chủ sách/Admin thấy (VND)"
                initialValue={initial.gia_toi_thieu}
              />
              <MoneyInput
                name="buoc_gia"
                label="Bước giá (VND)"
                initialValue={initial.buoc_gia}
              />
              <label>
                Chờ đặt lại (10–30 giây)
                <select
                  name="thoi_gian_cho_dat_lai"
                  required
                  value={cooldown}
                  onChange={(event) => setCooldown(event.target.value)}
                >
                  {[...new Set([10, 15, 20, 25, 30, Number(cooldown)])]
                    .sort((a, b) => a - b)
                    .map((n) => (
                      <option key={n} value={n}>
                        {n} giây
                      </option>
                    ))}
                </select>
              </label>
            </div>
            <p className="field-hint">
              Nhập số tiền VND nguyên; ô nhập chỉ chứa chữ số; dòng Giá trị bên
              dưới hiển thị dấu chấm phân cách hàng nghìn. Chỉ đặt lịch sau khi
              được Admin phê duyệt.
            </p>
          </div>
          <div data-step="3" hidden={step !== 3}>
            <h3>Kiểm tra trước khi gửi</h3>
            <p>
              Bài đăng chỉ đại diện cho một bản sách vật lý. Chưa có lịch đấu
              giá cho tới khi Admin phê duyệt và bạn kích hoạt.
            </p>
            <dl className="post-info">
              <dt>Tên sách</dt>
              <dd>{editableBook ? review.ten_sach : source?.ten_sach}</dd>
              <dt>ISBN</dt>
              <dd>
                {(editableBook ? review.isbn : source?.isbn) || "Không có ISBN"}
              </dd>
              <dt>Tác giả</dt>
              <dd>
                {(editableBook ? review.tac_gia : source?.tac_gia) || "Chưa rõ"}
              </dd>
              <dt>Thể loại</dt>
              <dd>
                {(editableBook ? review.the_loai : source?.the_loai) ||
                  "Chưa chọn"}
              </dd>
              <dt>Nhà xuất bản</dt>
              <dd>
                {(editableBook ? review.nha_xuat_ban : source?.nha_xuat_ban) ||
                  "Chưa rõ"}
              </dd>
              <dt>Năm xuất bản</dt>
              <dd>
                {(editableBook ? review.nam_xuat_ban : source?.nam_xuat_ban) ||
                  "Chưa rõ"}
              </dd>
              <dt>Tiêu đề bài</dt>
              <dd>{review.tieu_de}</dd>
              {mode === "resubmit" && (
                <>
                  <dt>Media giữ lại</dt>
                  <dd>{keptMedia.length} tệp</dd>
                  <dt>Media gỡ khỏi hồ sơ mới</dt>
                  <dd>{removed.length} tệp</dd>
                </>
              )}
              <dt>Media mới</dt>
              <dd>{media.length} tệp</dd>
              <dt>Giá khởi điểm</dt>
              <dd>
                {review.gia_khoi_diem &&
                  BigInt(review.gia_khoi_diem).toLocaleString("vi-VN")}{" "}
                đ
              </dd>
              <dt>Bước giá</dt>
              <dd>
                {review.buoc_gia &&
                  BigInt(review.buoc_gia).toLocaleString("vi-VN")}{" "}
                đ
              </dd>
            </dl>
            <label className="check-label">
              <input type="checkbox" required />
              Tôi xác nhận thông tin và media thuộc đúng bản sách này.
            </label>
          </div>
          <div className="actions wizard-actions">
            {step > 0 && (
              <button
                type="button"
                className="secondary"
                onClick={() => setStep((v) => v - 1)}
              >
                Quay lại
              </button>
            )}
            {step < 3 ? (
              <button
                type="button"
                className="primary"
                onClick={(event) => {
                  event.preventDefault();
                  next();
                }}
              >
                Tiếp tục
              </button>
            ) : (
              <button className="primary" disabled={locked}>
                {locked ? "Đang xử lý…" : "Gửi kiểm duyệt"}
              </button>
            )}
            <button type="button" className="text-button" onClick={onCancel}>
              Đóng biểu mẫu
            </button>
          </div>
        </fieldset>
      </form>
      {draft.status.progress && <p role="status">{draft.status.progress}</p>}
      {(error || draft.status.error) && (
        <p className="error" role="alert">
          {error || draft.status.error}
        </p>
      )}
    </section>
  );
}
