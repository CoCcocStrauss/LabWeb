"use client";
import { useEffect, useRef, useState } from "react";
import { AUDIO_MIME_CANDIDATES, MAX_AUDIO_BYTES, audioExtension } from "../lib/audio";
import { blobSha256, deleteAudioDraft, readAudioBlob, saveAudioBlob, saveAudioChunk } from "../lib/audioDraft";
import type { AudioMetadata } from "../lib/posttest";

export function VoiceRecorder({ audio, disabled, onChange, onBusyChange, acquireStream }: {
  audio: AudioMetadata | null; disabled: boolean; onChange: (audio: AudioMetadata | null) => void;
  onBusyChange: (busy: boolean) => void; acquireStream?: () => Promise<MediaStream>;
}) {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [state, setState] = useState<"idle" | "requesting" | "recording" | "saving">("idle");
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [playUrl, setPlayUrl] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const generation = useRef(0);
  const mounted = useRef(true);
  const callbacks = useRef({ onChange, onBusyChange }); callbacks.current = { onChange, onBusyChange };
  const audioRef = useRef(audio); audioRef.current = audio;
  useEffect(() => {
    mounted.current = true;
    setSupported(window.isSecureContext && !!window.MediaRecorder && (!!acquireStream || !!navigator.mediaDevices?.getUserMedia));
    return () => {
      mounted.current = false;
      // generation 是请求令牌，不是 DOM ref；清理时须使尚未返回的权限请求失效。
      // eslint-disable-next-line react-hooks/exhaustive-deps
      generation.current++;
      if (recorder.current?.state === "recording") recorder.current.stop();
      stream.current?.getTracks().forEach(track => track.stop());
    };
  }, [acquireStream]);
  useEffect(() => {
    if (!audio) { setPlayUrl(null); return; }
    let cancelled = false; let url: string | null = null;
    if (audio.state === "recording") {
      if (recorder.current?.state === "recording") return;
      callbacks.current.onChange({ ...audio, state: "interrupted" });
      setError("上次录音被中断，已保留本机草稿。请重新录音，或改用文字。");
      return;
    }
    void readAudioBlob(audio.recordingId).then(blob => {
      if (cancelled) return;
      if (blob) { url = URL.createObjectURL(blob); setPlayUrl(url); }
      else if (["ready", "uploading"].includes(audio.state)) {
        callbacks.current.onChange({ ...audio, state: "interrupted" });
        setError("未能恢复本机录音，请重新录音或改用文字。");
      }
      if (audio.state === "uploading" && blob && !disabled) callbacks.current.onChange({ ...audio, state: "ready" });
    }).catch(() => { if (!cancelled) setError("暂时无法读取本机录音，可以改用文字作答。"); });
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
  }, [audio, disabled]);

  const stop = useRef<() => void>(() => {});
  useEffect(() => {
    const onHidden = () => { if (document.visibilityState === "hidden") stop.current(); };
    const onPageHide = () => stop.current();
    document.addEventListener("visibilitychange", onHidden); window.addEventListener("pagehide", onPageHide);
    return () => { document.removeEventListener("visibilitychange", onHidden); window.removeEventListener("pagehide", onPageHide); };
  }, []);

  const start = async () => {
    if (!supported || disabled || state !== "idle") return;
    const token = ++generation.current;
    setError(null); setState("requesting"); callbacks.current.onBusyChange(true);
    try {
      const media = await (acquireStream ? acquireStream() : navigator.mediaDevices.getUserMedia({ audio: true }));
      if (!mounted.current || token !== generation.current) { media.getTracks().forEach(t => t.stop()); return; }
      stream.current = media;
      const mimeType = typeof MediaRecorder.isTypeSupported === "function" ? AUDIO_MIME_CANDIDATES.find(type => MediaRecorder.isTypeSupported(type)) : undefined;
      const instance = new MediaRecorder(media, { ...(mimeType ? { mimeType } : {}), audioBitsPerSecond: 64_000 });
      if (!audioExtension(instance.mimeType)) throw new Error("此浏览器的录音格式暂不支持，请使用文字作答。");
      recorder.current = instance;
      const id = crypto.randomUUID(); const chunks: Blob[] = [];
      let writes = Promise.resolve(); let writeFailed = false; let started = 0; let stoppedAt: number | null = null;
      let timer = 0; let bytes = 0;
      const metadata: AudioMetadata = { recordingId: id, state: "recording", mimeType: instance.mimeType,
        durationMs: 0, byteLength: 0, sha256: null, storagePath: null, recordedAt: Date.now(), finishedAt: null };
      stop.current = () => { if (instance.state === "recording") { stoppedAt = performance.now(); instance.stop(); } };
      instance.onstart = () => {
        started = performance.now(); metadata.recordedAt = Date.now();
        setState("recording"); setElapsed(0); callbacks.current.onChange({ ...metadata });
        timer = window.setInterval(() => { if (mounted.current) setElapsed(Math.max(0, performance.now() - started)); }, 250);
      };
      instance.ondataavailable = event => {
        if (!event.data.size) return;
        const index = chunks.length; chunks.push(event.data); bytes += event.data.size;
        writes = writes.then(() => saveAudioChunk(id, index, event.data)).catch(() => { writeFailed = true; stop.current(); });
        if (bytes > MAX_AUDIO_BYTES) stop.current();
      };
      instance.onerror = () => { writeFailed = true; stop.current(); };
      instance.onstop = () => {
        const durationMs = Math.max(0, Math.round((stoppedAt ?? performance.now()) - started));
        clearInterval(timer); media.getTracks().forEach(t => t.stop()); recorder.current = null;
        if (!mounted.current || token !== generation.current) return;
        setState("saving");
        void (async () => {
          try {
            await writes;
            if (writeFailed) throw new Error("录音未能保存到本机。请重录，或改用文字。");
            const blob = new Blob(chunks, { type: instance.mimeType });
            if (!blob.size || blob.size > MAX_AUDIO_BYTES) throw new Error("录音为空或超过20MB，请缩短后重录，或改用文字。");
            await saveAudioBlob(id, blob);
            const sha256 = await blobSha256(blob);
            if (!mounted.current || token !== generation.current) return;
            callbacks.current.onChange({ ...metadata, state: "ready", durationMs, byteLength: blob.size, sha256, finishedAt: Date.now() });
            setElapsed(durationMs);
          } catch (e) {
            if (mounted.current) {
              callbacks.current.onChange({ ...metadata, state: "interrupted" });
              setError(e instanceof Error ? e.message : "录音未能保存，可以改用文字。");
            }
          } finally { if (mounted.current) { setState("idle"); callbacks.current.onBusyChange(false); } }
        })();
      };
      instance.start(1000);
    } catch (e) {
      stream.current?.getTracks().forEach(t => t.stop());
      if (!mounted.current || token !== generation.current) return;
      const name = e instanceof DOMException ? e.name : "";
      setError(name === "NotAllowedError" ? "浏览器或所在问卷页面未允许使用麦克风。你可以直接改用下方文字入口。"
        : name === "NotFoundError" ? "未找到可用麦克风，你可以使用文字作答。"
        : name === "NotReadableError" ? "麦克风暂时不可用或被占用，可以稍后重试或使用文字。"
        : e instanceof Error ? e.message : "录音未能开始，可以使用文字作答。");
      setState("idle"); callbacks.current.onBusyChange(false);
    }
  };
  const active = state !== "idle";
  const recordedMs = state === "recording" || state === "saving" ? elapsed : audio?.durationMs ?? 0;
  const recordedSeconds = Math.floor(recordedMs / 1000);
  return <section className="rounded-xl border border-neutral-200 p-4" aria-label="录音解释">
    <p className="study-copy font-medium">用录音表达</p>
    {supported === false ? <p role="status" className="study-copy mt-3 text-neutral-700">此页面暂不支持录音，请使用下方文字入口。内嵌问卷还需要允许麦克风权限。</p> : null}
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <button type="button" disabled={disabled || !supported || state === "saving"} onClick={() => {
        if (state === "requesting") { generation.current++; setState("idle"); callbacks.current.onBusyChange(false); }
        else if (state === "recording") stop.current(); else void start();
      }} className="study-control rounded-lg bg-[#0084ff] px-4 py-2 text-white disabled:bg-neutral-200 disabled:text-neutral-500">
        {state === "requesting" ? "取消录音请求" : state === "recording" ? "停止录音" : state === "saving" ? "正在保留录音…" : audio ? "重新录音" : "开始录音"}
      </button>
      <span role="status" className="study-meta tabular-nums">{state === "requesting" ? "等待麦克风权限，不计入录音时长"
        : recordedMs >= 20_000 ? `已录音${recordedSeconds}秒，已达到最低时长`
        : recordedMs > 0 ? `已录音${recordedSeconds}秒，至少需要20秒`
        : "至少录制20秒"}</span>
      {audio && !active ? <button type="button" disabled={disabled} onClick={() => {
        void deleteAudioDraft(audio.recordingId).then(() => { callbacks.current.onChange(null); setPlayUrl(null); setError(null); })
          .catch(() => setError("暂时无法删除本机草稿，请稍后重试。"));
      }} className="study-control rounded-lg border border-neutral-300 px-4 py-2">删除录音</button> : null}
    </div>
    {playUrl ? <audio controls preload="metadata" src={playUrl} className="mt-4 w-full" aria-label="试听你的录音" /> : null}
    {audio?.state === "ready" && audio.durationMs < 20_000 ? <p className="study-meta mt-3 text-neutral-600">这段录音不足20秒。可以重录，或用至少20个有效字符的文字完成解释。</p> : null}
    {audio?.state === "excluded" ? <p className="study-meta mt-3">这段录音保留在本机，本次选择仅提交文字。</p> : null}
    {error ? <p role="alert" className="study-copy mt-3 text-red-700">{error}</p> : null}
  </section>;
}
