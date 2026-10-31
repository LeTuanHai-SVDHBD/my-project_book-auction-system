/** Biểu mẫu sách/bài đăng; tệp được tải trước, chỉ vé upload được gửi cùng nội dung. */
import { useEffect, useRef, useState } from "react";
import { postApi } from "../services/postApi.js";
import UploadMediaCard from "./UploadMediaCard.jsx";
import MoneyInput from "./MoneyInput.jsx";
import GenreSelect from "./GenreSelect.jsx";
import { ISBN_MAX_LENGTH } from "../../../shared/bookIdentifiers.js";
export default function PostForm({
  source,
  mode = "create",
  onSaved,
  onCancel,
}) {
  const [step, setStep] = useState(0),
    [review, setReview] = useState({});
  const formRef = useRef(null);
  const [isbnMode, setIsbnMode] = useState(source?.isbn ? "has" : "none"),
    [isbn, setIsbn] = useState(source?.isbn || "");
  const [config, setConfig] = useState(null);
  const [media, setMedia] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");
  const [cooldown, setCooldown] = useState(() =>
    String(source?.thoi_gian_cho_dat_lai ?? 20),
  );
  const [requestId] = useState(() => crypto.randomUUID());
  const tickets = useRef([]);
  const submitted = useRef(false);
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
      if (!submitted.current)
        for (const item of tickets.current)
          void postApi.discard(item.upload_id).catch(() => {});
    };
  }, []);
  async function upload(event) {
    const files = [...event.target.files];
    event.target.value = "";
    setBusy(true);
    setError("");
    try {
      for (const [index, file] of files.entries()) {
        const image = config.imageTypes.includes(file.type);
        const video = config.videoTypes.includes(file.type);
        if (video) {
          const reused =
            mode === "resubmit" ||
            (mode === "relist" &&
              formRef.current?.elements.reuse_media?.checked);
          const existing = reused
            ? (source?.media || []).filter((item) => item.kind === "video")
                .length
            : 0;
          if (
            existing +
              tickets.current.filter((item) => item.kind === "video").length >=
            config.maxVideos
          )
            throw new Error(
              `Tối đa ${config.maxVideos} video cho mỗi bài đăng, tính cả video giữ lại.`,
            );
        }
        if (!image && !video)
          throw new Error("Chỉ hỗ trợ JPEG, PNG, WebP, MP4 và WebM.");
        if (file.size > (image ? config.imageMaxBytes : config.videoMaxBytes))
          throw new Error(
            `Tệp ${file.name} vượt giới hạn ${Math.round((image ? config.imageMaxBytes : config.videoMaxBytes) / 1048576)} MB.`,
          );
        setProgress(`Đang tải ${index + 1}/${files.length}: ${file.name}`);
        const result = await postApi.upload(file);
        const item = { ...result, tieu_de: file.name.slice(0, 500) };
        tickets.current = [...tickets.current, item];
        setMedia(tickets.current);
      }
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
      setProgress("");
    }
  }
  async function remove(item) {
    setBusy(true);
    setError("");
    try {
      await postApi.discard(item.upload_id);
      tickets.current = tickets.current.filter(
        (x) => x.upload_id !== item.upload_id,
      );
      setMedia(tickets.current);
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }
  async function submit(event) {
    event.preventDefault();
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
    if (mode === "create")
      body.sach = Object.fromEntries(
        [
          "ten_sach",
          "tac_gia",
          "the_loai",
          "nha_xuat_ban",
          "isbn",
          "mo_ta",
        ]
          .map((key) => [key, data[key] || null])
          .concat([
            [
              "nam_xuat_ban",
              data.nam_xuat_ban ? Number(data.nam_xuat_ban) : null,
            ],
          ]),
      );
    else {
      body.reuse_media = mode === "resubmit" || data.reuse_media === "on";
      if (mode === "resubmit") {
        delete body.ma_yeu_cau;
        body.row_version = source.row_version;
      }
    }
    try {
      const result = await postApi.save(body, source?.bai_dang_id, mode);
      submitted.current = true;
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
    value = source?.[name] ?? "",
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
      <form ref={formRef} noValidate onSubmit={submit}>
        <fieldset disabled={busy}>
          <div data-step="0" hidden={step !== 0}>
            {mode === "create" ? (
              <>
                <h3>Thông tin bản sách</h3>
                <div className="form-grid">
                  {input("ten_sach", "Tên sách", 300, true)}
                  {input("tac_gia", "Tác giả", 200)}
                  <GenreSelect />
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
                  <textarea name="mo_ta" maxLength={12000} />
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
                defaultValue={source?.mo_ta_tinh_trang || ""}
                required
                maxLength={12000}
                rows={7}
                aria-describedby="book-review-hint"
              />
            </label>
            <p className="field-hint" id="book-review-hint">
              Mô tả tình trạng bìa, gáy, trang giấy và các hư hỏng nếu có; nêu
              đặc điểm quý hiếm như bản in đầu, chữ ký, số lượng giới hạn… và
              chỉ rõ ảnh/video minh chứng. Nếu không biết thông tin nào, hãy
              ghi rõ chưa xác định.
            </p>
          </div>
          <div data-step="1" hidden={step !== 1}>
            <h3>Ảnh và video</h3>
            {mode === "relist" && (
              <label className="check-label">
                <input type="checkbox" name="reuse_media" defaultChecked />
                Dùng lại media của bài cũ
              </label>
            )}
            <p className="field-hint">
              {config
                ? `Không giới hạn số lượng ảnh (${config.imageMaxBytes / 1048576} MB/ảnh). Tối đa ${config.maxVideos} video (${config.videoMaxBytes / 1048576} MB/video). JPEG, PNG, WebP, MP4, WebM.`
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
                accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
                disabled={!config?.configured || busy}
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
                  disabled={busy}
                />
              ))}
            </div>
            {source?.media?.length > 0 && (
              <>
                <h4>Media đã gắn với bản sách</h4>
                <p className="field-hint">
                  Media đã lưu được giữ lại cùng lịch sử bài đăng. Nút × chỉ áp
                  dụng cho tệp vừa tải lên.
                </p>
                <div className="media-grid">
                  {source.media.map((item) => (
                    <figure key={item.url}>
                      {item.kind === "image" ? (
                        <img src={item.url} alt={item.title || "Ảnh sách"} />
                      ) : (
                        <video src={item.url} controls preload="metadata" />
                      )}
                      <figcaption>{item.title}</figcaption>
                    </figure>
                  ))}
                </div>
              </>
            )}
          </div>
          <div data-step="2" hidden={step !== 2}>
            <h3>Thông số đấu giá</h3>
            <div className="form-grid">
              <MoneyInput
                name="gia_khoi_diem"
                label="Giá khởi điểm (VND)"
                initialValue={source?.gia_khoi_diem}
              />
              <MoneyInput
                name="gia_toi_thieu"
                label="Giá kết thúc sớm — chỉ chủ sách/Admin thấy (VND)"
                initialValue={source?.gia_toi_thieu}
              />
              <MoneyInput
                name="buoc_gia"
                label="Bước giá (VND)"
                initialValue={source?.buoc_gia}
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
              <dd>{source?.ten_sach || review.ten_sach}</dd>
              <dt>ISBN</dt>
              <dd>{source?.isbn || review.isbn || "Không có ISBN"}</dd>
              <dt>Tiêu đề bài</dt>
              <dd>{review.tieu_de}</dd>
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
              <button type="button" className="primary" onClick={next}>
                Tiếp tục
              </button>
            ) : (
              <button className="primary">
                {busy ? "Đang xử lý…" : "Gửi kiểm duyệt"}
              </button>
            )}
            <button type="button" className="text-button" onClick={onCancel}>
              Đóng biểu mẫu
            </button>
          </div>
        </fieldset>
      </form>
      {progress && <p role="status">{progress}</p>}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
