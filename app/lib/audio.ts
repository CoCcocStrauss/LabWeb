import type { AudioMetadata } from "./posttest";
import { postJson } from "./dataSubmit";
import { readAudioBlob } from "./audioDraft";

export { AUDIO_BUCKET, MAX_AUDIO_BYTES, MIN_AUDIO_MS, AUDIO_MIME_CANDIDATES, audioBaseMime, audioExtension } from "./audioConfig";

export async function uploadAudio(identity: { uid: string; sessionId: string; sessionSecret: string }, audio: AudioMetadata, signal: AbortSignal): Promise<AudioMetadata> {
  if (audio.state === "uploaded") return audio;
  const blob = await readAudioBlob(audio.recordingId);
  if (!blob || blob.size !== audio.byteLength || !audio.sha256) throw new Error("本机录音不可用，请重录或改为文字。");
  const body = { uid: identity.uid, sessionId: identity.sessionId, sessionSecret: identity.sessionSecret, recording: audio };
  const prepared = await postJson<{ uploaded: boolean; signedUrl?: string; storagePath: string }>("/api/audio/prepare", body);
  if (signal.aborted) throw new DOMException("已取消上传", "AbortError");
  if (!prepared.uploaded) {
    if (!prepared.signedUrl) throw new Error("无法取得录音上传地址");
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal.addEventListener("abort", abort, { once: true });
    const timer = setTimeout(abort, 60_000);
    try {
      const response = await fetch(prepared.signedUrl, { method: "PUT", headers: { "Content-Type": audio.mimeType }, body: blob, signal: controller.signal });
      // 已存在可能是上次响应丢失；交给服务端核对同一路径的字节摘要，不覆盖文件。
      if (!response.ok && response.status !== 409 && response.status !== 400) throw new Error("录音上传未成功，请重试。");
    } finally { clearTimeout(timer); signal.removeEventListener("abort", abort); }
    if (signal.aborted) throw new DOMException("已取消上传", "AbortError");
    await postJson("/api/audio/confirm", body, 30_000);
  }
  return { ...audio, state: "uploaded", storagePath: prepared.storagePath };
}
