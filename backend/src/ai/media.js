/** Photos share an inline budget; videos use bounded sequential Files uploads and retain original evidence IDs. */
import { mediaDisplayUrl } from "../../../shared/mediaDelivery.js";
import { verifyMedia } from "../services/cloudinary.service.js";
import { boundedBytes } from "./transport.js";
export async function prepareAiMedia({
  media,
  config,
  fetchImpl,
  signal,
  onProgress = async () => {},
  uploadVideo,
}) {
  const started = Date.now(),
    deadline = AbortSignal.timeout(config.mediaPrepareTimeout || 45000);
  const imageSignal = AbortSignal.any([signal, deadline]),
    outcomes = new Map();
  let used = 0,
    completed = 0;
  const reasons = {
    budget: "vượt ngân sách ảnh gửi AI",
    prepare_timeout: "hết thời gian chuẩn bị ảnh",
    download_timeout: "tải media hết thời gian chờ",
    untrusted: "URL không được phép",
    invalid: "định dạng media không hợp lệ",
    unavailable: "không tải được media",
    video_size: "video vượt giới hạn dung lượng gửi Files API",
    video_timeout: "hết thời gian tải/xử lý video tại Gemini Files API",
    video_failed: "Gemini Files API không xử lý được video",
    video_access:
      "Gemini Files API từ chối quyền hoặc hạn mức; kiểm tra cấu hình tài khoản",
  };
  async function download(item, limit, taskSignal, timeout) {
    let response;
    try {
      const url = new URL(item.url);
      if (
        !["image", "video"].includes(item.kind) ||
        url.protocol !== "https:" ||
        url.hostname !== "res.cloudinary.com" ||
        url.username ||
        url.password ||
        url.port ||
        !config.cloudName ||
        !url.pathname.startsWith(`/${config.cloudName}/${item.kind}/upload/`)
      )
        return { reason: "untrusted" };
      const requestSignal = AbortSignal.any([
        taskSignal,
        AbortSignal.timeout(timeout),
      ]);
      response = await fetchImpl(mediaDisplayUrl(url.href, item.kind), {
        redirect: "error",
        signal: requestSignal,
      });
      if (!response.ok) {
        void response.body?.cancel().catch(() => {});
        return { reason: "unavailable" };
      }
      const mime = (response.headers.get("content-type") || "").split(";")[0];
      if (
        ![
          "image/jpeg",
          "image/png",
          "image/webp",
          "video/mp4",
          "video/webm",
        ].includes(mime) ||
        !mime.startsWith(item.kind + "/")
      ) {
        void response.body?.cancel().catch(() => {});
        return { reason: "invalid" };
      }
      const bytes = await boundedBytes(response, limit, requestSignal);
      verifyMedia(bytes, mime, item.kind);
      return { bytes, mime };
    } catch (error) {
      void response?.body?.cancel().catch(() => {});
      return {
        reason: taskSignal.aborted
          ? item.kind === "video"
            ? "video_timeout"
            : "prepare_timeout"
          : ["TimeoutError", "AbortError"].includes(error.name)
            ? "download_timeout"
            : error.message === "AI_RESPONSE_TOO_LARGE"
              ? item.kind === "video"
                ? "video_size"
                : "budget"
              : "invalid",
      };
    }
  }
  const progress = () =>
    onProgress({
      phase: "media",
      media_completed: completed,
      media_total: media.length,
    });
  await progress();
  const images = media.filter((x) => x.kind !== "video");
  for (let offset = 0; offset < images.length; ) {
    signal.throwIfAborted();
    if (deadline.aborted || used >= config.mediaMaxBytes) {
      for (const item of images.slice(offset)) {
        outcomes.set(item.id, {
          reason: deadline.aborted ? "prepare_timeout" : "budget",
        });
        completed++;
      }
      break;
    }
    const batch = images.slice(offset, offset + (config.mediaConcurrency || 4));
    const results = await Promise.all(
      batch.map((item) =>
        download(
          item,
          config.mediaMaxBytes - used,
          imageSignal,
          config.mediaDownloadTimeout || 15000,
        ),
      ),
    );
    signal.throwIfAborted();
    for (let i = 0; i < batch.length; i++) {
      const item = batch[i],
        result = results[i];
      completed++;
      if (result.reason) {
        outcomes.set(item.id, result);
        continue;
      }
      if (used + result.bytes.length > config.mediaMaxBytes) {
        outcomes.set(item.id, { reason: "budget" });
        continue;
      }
      used += result.bytes.length;
      outcomes.set(item.id, {
        part: {
          type: "image",
          data: result.bytes.toString("base64"),
          mime_type: result.mime,
        },
        bytes: result.bytes.length,
        input_method: "inline",
      });
    }
    offset += batch.length;
    await progress();
  }
  await progress();
  // One video buffer at a time. Uploads/polling do not consume the photo deadline or inline byte budget.
  for (const item of media.filter((x) => x.kind === "video")) {
    signal.throwIfAborted();
    const videoSignal = AbortSignal.any([
      signal,
      AbortSignal.timeout(config.videoPrepareTimeout || 300000),
    ]);
    try {
      await onProgress({
        phase: "video_download",
        media_id: item.id,
        media_completed: completed,
        media_total: media.length,
      });
      const downloaded = await download(
        item,
        config.videoMaxBytes || 100 * 1048576,
        videoSignal,
        config.videoDownloadTimeout || 120000,
      );
      if (downloaded.reason) outcomes.set(item.id, downloaded);
      else if (!uploadVideo) outcomes.set(item.id, { reason: "video_failed" });
      else {
        const uploaded = await uploadVideo({
          bytes: downloaded.bytes,
          mime: downloaded.mime,
          id: item.id,
          signal: videoSignal,
          onProgress: (value) =>
            onProgress({
              ...value,
              media_completed: completed,
              media_total: media.length,
            }),
        });
        outcomes.set(item.id, {
          ...uploaded,
          input_method: "files_api",
          full_file: true,
          sampling: "provider_default",
        });
      }
    } catch (error) {
      const reason =
        videoSignal.aborted ||
        ["TimeoutError", "AbortError"].includes(error.name) ||
        error.code === "AI_FILE_PROCESSING_TIMEOUT"
          ? "video_timeout"
          : [
                "AI_KEY_INVALID",
                "AI_ACCESS_DENIED",
                "AI_QUOTA_EXCEEDED",
                "AI_BILLING_REQUIRED",
              ].includes(error.code)
            ? "video_access"
            : "video_failed";
      outcomes.set(item.id, { reason });
    }
    signal.throwIfAborted();
    completed++;
    await progress();
  }
  const manifest = [],
    parts = [],
    mediaIds = [],
    warnings = [];
  for (const item of media) {
    const result = outcomes.get(item.id) || { reason: "invalid" };
    if (result.reason) {
      manifest.push({
        id: item.id,
        kind: item.kind,
        url: item.url,
        sent: false,
        reason: result.reason,
      });
      warnings.push(
        `Media ${item.id} chưa được phân tích: ${reasons[result.reason]}.`,
      );
      continue;
    }
    parts.push(
      { type: "text", text: `Media ${item.id}: ${item.title || item.kind}` },
      result.part,
    );
    mediaIds.push(item.id);
    const { part, ...details } = result;
    manifest.push({
      id: item.id,
      kind: item.kind,
      url: item.url,
      sent: true,
      ...details,
    });
  }
  return {
    parts,
    mediaIds,
    manifest,
    warnings,
    media_ms: Date.now() - started,
  };
}
