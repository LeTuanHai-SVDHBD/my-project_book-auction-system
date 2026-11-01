/** Temporary Gemini Files uploads for videos; no inline/base64 size budget and no arbitrary upload hosts. */
import { setTimeout as delay } from "node:timers/promises";
import { boundedBytes } from "./transport.js";
import { geminiFailure, geminiHttpFailure } from "./errors.js";
const origin = "https://generativelanguage.googleapis.com";
const validName = (name) =>
  typeof name === "string" &&
  /^files\/[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/.test(name);
export function createGeminiFiles({ config, fetchImpl = fetch, wait = delay }) {
  const names = new Set(),
    headers = { "x-goog-api-key": config.key };
  async function json(response, signal) {
    const body = JSON.parse(
      (await boundedBytes(response, 65536, signal)).toString("utf8"),
    );
    if (!response.ok) throw geminiHttpFailure(response.status, body);
    return body;
  }
  async function check(response, signal) {
    if (!response.ok) {
      let body;
      try {
        body = JSON.parse(
          (await boundedBytes(response, 65536, signal)).toString("utf8"),
        );
      } catch {}
      throw geminiHttpFailure(response.status, body);
    }
  }
  return {
    async upload({ bytes, mime, id, signal, onProgress = async () => {} }) {
      signal.throwIfAborted();
      await onProgress({ phase: "video_upload", media_id: id });
      const start = await fetchImpl(origin + "/upload/v1beta/files", {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
          "X-Goog-Upload-Protocol": "resumable",
          "X-Goog-Upload-Command": "start",
          "X-Goog-Upload-Header-Content-Length": String(bytes.length),
          "X-Goog-Upload-Header-Content-Type": mime,
        },
        body: JSON.stringify({ file: { display_name: `Book review ${id}` } }),
        signal,
        redirect: "error",
      });
      await check(start, signal);
      let uploadUrl;
      try {
        uploadUrl = new URL(start.headers.get("x-goog-upload-url"));
      } catch {}
      void start.body?.cancel().catch(() => {});
      if (
        !uploadUrl ||
        uploadUrl.origin !== origin ||
        uploadUrl.username ||
        uploadUrl.password ||
        uploadUrl.hash ||
        uploadUrl.pathname !== "/upload/v1beta/files"
      )
        throw geminiFailure("AI_FILE_INVALID_RESPONSE");
      const uploaded = await fetchImpl(uploadUrl.href, {
        method: "POST",
        headers: {
          "Content-Type": mime,
          "Content-Length": String(bytes.length),
          "X-Goog-Upload-Offset": "0",
          "X-Goog-Upload-Command": "upload, finalize",
        },
        body: bytes,
        signal,
        redirect: "error",
      });
      const result = await json(uploaded, signal);
      let file = result.file;
      if (!validName(file?.name))
        throw geminiFailure("AI_FILE_INVALID_RESPONSE");
      const name = file.name;
      if (names.has(name)) throw geminiFailure("AI_FILE_INVALID_RESPONSE");
      names.add(name);
      await onProgress({ phase: "video_processing", media_id: id });
      for (
        let attempt = 0;
        attempt <
        (config.filePollAttempts ??
          Math.ceil(
            (config.videoPrepareTimeout || 300000) /
              (config.filePollDelayMs || 2000),
          ));
        attempt++
      ) {
        if (file.name !== name || (file.mimeType && file.mimeType !== mime))
          throw geminiFailure("AI_FILE_INVALID_RESPONSE");
        if (file.state === "FAILED")
          throw geminiFailure("AI_FILE_PROCESSING_FAILED");
        if (file.state === "ACTIVE") {
          let uri;
          try {
            uri = new URL(file.uri);
          } catch {}
          if (
            !uri ||
            uri.origin !== origin ||
            uri.pathname !== "/v1beta/" + name ||
            uri.username ||
            uri.password ||
            uri.search ||
            uri.hash
          )
            throw geminiFailure("AI_FILE_INVALID_RESPONSE");
          const duration = /^(\d+(?:\.\d+)?)s$/.exec(
            file.videoMetadata?.videoDuration || "",
          );
          return {
            part: { type: "video", uri: uri.href, mime_type: mime },
            bytes: bytes.length,
            ...(duration ? { duration_seconds: Number(duration[1]) } : {}),
          };
        }
        if (file.state && file.state !== "PROCESSING")
          throw geminiFailure("AI_FILE_INVALID_RESPONSE");
        await wait(config.filePollDelayMs ?? 2000, undefined, { signal });
        signal.throwIfAborted();
        file = await json(
          await fetchImpl(origin + "/v1beta/" + name, {
            headers,
            signal,
            redirect: "error",
          }),
          signal,
        );
      }
      throw geminiFailure("AI_FILE_PROCESSING_TIMEOUT");
    },
    async cleanup() {
      // Cleanup has its own bounded signal: cancellation must still permit deletion of known temporary files.
      const outcomes = await Promise.allSettled(
        [...names].map(async (name) => {
          const response = await fetchImpl(origin + "/v1beta/" + name, {
            method: "DELETE",
            headers,
            signal: AbortSignal.timeout(config.fileCleanupTimeoutMs ?? 10000),
            redirect: "error",
          });
          void response.body?.cancel().catch(() => {});
          if (!response.ok && response.status !== 404)
            throw Error("FILE_CLEANUP_FAILED");
          names.delete(name);
        }),
      );
      return outcomes.filter((x) => x.status === "rejected").length;
    },
  };
}
