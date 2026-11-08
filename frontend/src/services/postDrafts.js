/** Account-scoped local drafts; uploads belong to the draft rather than a mounted form. */
import { getSessionRevision } from "./authApi.js";
import { postApi } from "./postApi.js";
const fieldLimits = {
  ten_sach: 300,
  tac_gia: 200,
  the_loai: 200,
  nha_xuat_ban: 200,
  nam_xuat_ban: 4,
  isbn: 100,
  mo_ta: 12000,
  tieu_de: 300,
  mo_ta_tinh_trang: 12000,
  gia_khoi_diem: 18,
  gia_toi_thieu: 18,
  buoc_gia: 18,
  thoi_gian_cho_dat_lai: 2,
  reuse_media: 3,
};
const prefix = "bookbid:post-draft:v1:";
export const postCoverKey = (item) =>
  item.kind === "image"
    ? item.upload_id ? `upload:${item.upload_id}` : item.id ? `saved:${item.id}` : null
    : null;
export function createPostDrafts({
  storage,
  api = postApi,
  now = Date.now,
  uuid = () => crypto.randomUUID(),
  sessionRevision = getSessionRevision,
} = {}) {
  const entries = new Map();
  function open({ owner, mode = "create", source }) {
    if (!Number.isSafeInteger(owner) || owner <= 0)
      throw new Error("Bản nháp cần tài khoản người bán.");
    const key = `${prefix}${owner}:${mode}:${source?.bai_dang_id || "new"}`,
      version = source?.row_version || null;
    let entry = entries.get(key);
    if (entry && entry.data.sourceVersion === version && !entry.closed)
      return entry;
    if (entry) {
      entry.closed = true;
      entries.delete(key);
    }
    let saved = null,
      storageError = "",
      notice = "";
    try {
      const raw = storage?.getItem(key);
      if (raw) saved = JSON.parse(raw);
    } catch {
      storageError = "Không đọc được nháp đã lưu trên trình duyệt.";
    }
    if (saved && saved.sourceVersion !== version) {
      saved = null;
      notice =
        "Hồ sơ nguồn đã thay đổi. Biểu mẫu dùng dữ liệu mới nhất; nháp cũ không được áp dụng.";
    }
    const fields = {};
    for (const [name, max] of Object.entries(fieldLimits))
      if (typeof saved?.fields?.[name] === "string")
        fields[name] = saved.fields[name].slice(0, max);
    const expired = (Array.isArray(saved?.media) ? saved.media : []).some(
      (x) => !Number.isFinite(x?.expires_at) || x.expires_at <= now(),
    );
    const media = (Array.isArray(saved?.media) ? saved.media : [])
      .filter(
        (x) =>
          typeof x?.upload_id === "string" &&
          /^[\da-f-]{36}$/i.test(x.upload_id) &&
          ["image", "video"].includes(x.kind) &&
          typeof x.url === "string" &&
          x.url.startsWith("https://res.cloudinary.com/") &&
          x.expires_at > now(),
      )
      .map((x) => ({
        upload_id: x.upload_id,
        url: x.url,
        kind: x.kind,
        tieu_de: String(x.tieu_de || "").slice(0, 500),
        expires_at: x.expires_at,
      }));
    const removed = (Array.isArray(saved?.removed) ? saved.removed : [])
      .filter(
        (x) =>
          Number.isSafeInteger(x?.id) && ["image", "video"].includes(x.kind),
      )
      .map((x) => ({ id: x.id, kind: x.kind }));
    if (expired)
      notice +=
        " Một số tệp nháp đã hết hạn và được bỏ khỏi biểu mẫu; hãy chọn lại trước khi gửi.";
    if (saved?.pending)
      notice +=
        " Trang đã được tải lại khi đang tải tệp. Lượt tải đó chưa được xác nhận trong nháp; kiểm tra trước khi chọn lại, không tải lặp liên tục.";
    entry = {
      data: {
        sourceVersion: version,
        fields,
        step: Number.isInteger(saved?.step)
          ? Math.max(0, Math.min(3, saved.step))
          : 0,
        isbnMode:
          saved?.isbnMode === "has"
            ? "has"
            : saved?.isbnMode === "none"
              ? "none"
              : source?.isbn
                ? "has"
                : "none",
        isbn:
          typeof saved?.isbn === "string"
            ? saved.isbn.slice(0, 100)
            : source?.isbn || "",
        removed,
        media,
        coverKey: typeof saved?.coverKey === "string" &&
          /^(?:upload:[\da-f-]{36}|saved:\d{1,10})$/i.test(saved.coverKey)
          ? saved.coverKey : null,
        requestId: /^[\da-f-]{36}$/i.test(saved?.requestId || "")
          ? saved.requestId
          : uuid(),
        pending: false,
        savedAt: saved?.savedAt || null,
      },
      status: {
        busy: false,
        progress: "",
        error: "",
        storageError,
        notice: notice.trim(),
      },
      closed: false,
    };
    let revision = 0;
    const listeners = new Set();
    const emit = () => {
      revision++;
      for (const notify of listeners) notify();
    };
    const persist = () => {
      try {
        storage?.setItem(key, JSON.stringify(entry.data));
        entry.status.storageError = storage
          ? ""
          : "Trình duyệt không cho lưu nháp; dữ liệu chỉ được giữ khi ứng dụng đang mở.";
      } catch {
        entry.status.storageError =
          "Không lưu được nháp trên trình duyệt (bộ nhớ đầy hoặc bị chặn). Giữ trang mở để không mất dữ liệu.";
      }
    };
    const patch = (status) => {
      if (entry.closed) return;
      Object.assign(entry.status, status);
      persist();
      emit();
    };
    const discard = async (item) => {
      try {
        await api.discard(item.upload_id);
      } catch {
        /* The staging cleanup protects SQL references and removes abandoned tickets. */
      }
    };
    entry.subscribe = (notify) => {
      listeners.add(notify);
      return () => listeners.delete(notify);
    };
    entry.snapshot = () => revision;
    entry.selectCover = (item) => {
      if (entry.closed) return;
      const key = item ? postCoverKey(item) : null;
      if (item && !key) return;
      entry.data.coverKey = key;
      patch({});
    };
    entry.save = (values) => {
      if (!entry.closed) {
        const fields = {};
        for (const [name, max] of Object.entries(fieldLimits))
          if (typeof values.fields?.[name] === "string")
            fields[name] = values.fields[name].slice(0, max);
        Object.assign(entry.data, values, { fields, savedAt: now() });
        const previous = entry.status.storageError;
        persist();
        if (previous !== entry.status.storageError) emit();
      }
    };
    entry.clear = ({ submitted = false } = {}) => {
      entry.closed = true;
      entries.delete(key);
      try {
        storage?.removeItem(key);
      } catch {}
      if (!submitted) for (const item of entry.data.media) void discard(item);
    };
    entry.remove = async (item) => {
      if (entry.status.busy || entry.closed) return;
      patch({ busy: true, error: "" });
      try {
        await api.discard(item.upload_id);
        entry.data.media = entry.data.media.filter(
          (x) => x.upload_id !== item.upload_id,
        );
        if (entry.data.coverKey === postCoverKey(item)) entry.data.coverKey = null;
      } catch (error) {
        patch({ error: error.message });
      } finally {
        patch({ busy: false });
      }
    };
    entry.upload = async (files, config, existingVideos = 0) => {
      if (entry.status.busy || entry.closed) return;
      const session = sessionRevision();
      entry.data.pending = true;
      patch({ busy: true, error: "" });
      const errors = [];
      try {
        for (const [index, file] of files.entries()) {
          if (entry.closed) break;
          patch({
            progress: `Đang tải ${index + 1}/${files.length}: ${file.name} — chuyển trang trong ứng dụng vẫn tiếp tục tải.`,
          });
          try {
            const actual = await api.identify(file),
              image = actual.kind === "image";
            if (sessionRevision() !== session)
              throw Object.assign(
                new Error(
                  "Phiên đăng nhập đã thay đổi; lượt tải chưa gửi được dừng lại.",
                ),
                { status: 401 },
              );
            if (
              !image &&
              existingVideos +
                entry.data.media.filter((x) => x.kind === "video").length >=
                config.maxVideos
            )
              throw Error(
                `Tối đa ${config.maxVideos} video, tính cả video giữ lại.`,
              );
            if (
              file.size > (image ? config.imageMaxBytes : config.videoMaxBytes)
            )
              throw Error(
                `Tệp vượt giới hạn ${Math.round((image ? config.imageMaxBytes : config.videoMaxBytes) / 1048576)} MB.`,
              );
            const result = await api.upload(file, config, actual, session),
              item = { ...result, tieu_de: file.name.slice(0, 500) };
            if (entry.closed) {
              await discard(item);
              break;
            }
            entry.data.media = [...entry.data.media, item];
            patch({});
          } catch (error) {
            errors.push(`${file.name}: ${error.message}`);
            if (
              [401, 403].includes(error.status) ||
              error.code === "ACCOUNT_REPLACED"
            )
              break;
          }
        }
      } finally {
        entry.data.pending = false;
        patch({ busy: false, progress: "", error: errors.join("\n") });
      }
    };
    entry.pruneExpired = () => {
      const old = entry.data.media;
      entry.data.media = old.filter((x) => x.expires_at > now());
      if (old.length !== entry.data.media.length) {
        if (entry.data.coverKey?.startsWith("upload:") &&
            !entry.data.media.some((item) => postCoverKey(item) === entry.data.coverKey))
          entry.data.coverKey = null;
        patch({
          error:
            "Một số tệp nháp đã hết hạn. Hãy kiểm tra lại ảnh/video và chọn lại các tệp đó trước khi gửi.",
        });
        return true;
      }
      return false;
    };
    entries.set(key, entry);
    return entry;
  }
  return { open };
}
let drafts;
export function openPostDraft(options) {
  if (!drafts) {
    let storage;
    try {
      storage = window.localStorage;
    } catch {}
    drafts = createPostDrafts({ storage });
  }
  return drafts.open(options);
}
