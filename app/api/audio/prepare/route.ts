import { NextResponse } from "next/server";
import { AUDIO_BUCKET, audioExtension } from "../../../lib/audioConfig";
import { validAudioRequest } from "../../../lib/audioRequest";
import { authorizeSession, hashSessionSecret, SessionAccessError } from "../../../lib/serverSession";
import { readRequestJson } from "../../../lib/submissionValidation";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await readRequestJson(request);
    if (!validAudioRequest(body)) return NextResponse.json({ error: "Invalid recording" }, { status: 400 });
    const db = await authorizeSession(body);
    const a = body.recording;
    const storagePath = `${body.sessionId}/${a.recordingId}.${audioExtension(a.mimeType)}`;
    const { data: uploaded, error } = await db.rpc("prepare_experiment_audio", {
      p_uid: body.uid, p_session_id: body.sessionId, p_secret_hash: hashSessionSecret(body.sessionSecret),
      p_recording_id: a.recordingId, p_storage_path: storagePath, p_mime_type: a.mimeType,
      p_byte_length: a.byteLength, p_duration_ms: a.durationMs, p_sha256: a.sha256,
    });
    if (error || typeof uploaded !== "boolean") throw new Error("录音信息尚未保存，请稍后重试。");
    const { data: bucket, error: bucketError } = await db.storage.getBucket(AUDIO_BUCKET);
    if (bucketError || bucket?.public !== false) throw new Error("录音私有存储尚未就绪，可以保留草稿重试或使用文字。");
    if (uploaded) return NextResponse.json({ uploaded: true, storagePath });
    const { data, error: signingError } = await db.storage.from(AUDIO_BUCKET).createSignedUploadUrl(storagePath, { upsert: false });
    if (signingError || !data) throw new Error("暂时无法取得录音上传地址。");
    return NextResponse.json({ uploaded: false, storagePath, signedUrl: data.signedUrl }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof SessionAccessError ? e.message : "录音上传准备失败，可以保留草稿重试或使用文字。" }, { status: e instanceof SessionAccessError ? e.status : 500 });
  }
}
