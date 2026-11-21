import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { AUDIO_BUCKET, audioBaseMime, audioExtension, MAX_AUDIO_BYTES } from "../../../lib/audioConfig";
import { validAudioRequest } from "../../../lib/audioRequest";
import { authorizeSession, hashSessionSecret, SessionAccessError } from "../../../lib/serverSession";
import { readRequestJson } from "../../../lib/submissionValidation";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await readRequestJson(request);
    if (!validAudioRequest(body)) return NextResponse.json({ error: "Invalid recording" }, { status: 400 });
    const db = await authorizeSession(body); const a = body.recording;
    const path = `${body.sessionId}/${a.recordingId}.${audioExtension(a.mimeType)}`;
    const storage = db.storage.from(AUDIO_BUCKET);
    const { data: bucket, error: bucketError } = await db.storage.getBucket(AUDIO_BUCKET);
    if (bucketError || bucket?.public !== false) throw new Error("Private storage unavailable");
    const { data: info, error: infoError } = await storage.info(path);
    if (infoError || !info || info.size !== a.byteLength || info.size > MAX_AUDIO_BYTES ||
        audioBaseMime(info.contentType ?? "") !== audioBaseMime(a.mimeType)) throw new Error("File metadata mismatch");
    const { data: blob, error: downloadError } = await storage.download(path);
    if (downloadError || !blob || blob.size !== a.byteLength) throw new Error("File not available");
    const bytes = Buffer.from(await blob.arrayBuffer());
    const mime = audioBaseMime(a.mimeType);
    const validContainer = mime === "audio/webm" ? bytes.subarray(0, 4).toString("hex") === "1a45dfa3"
      : mime === "audio/mp4" ? bytes.subarray(4, 8).toString() === "ftyp" : bytes.subarray(0, 4).toString() === "OggS";
    if (!validContainer || createHash("sha256").update(bytes).digest("hex") !== a.sha256) throw new Error("File integrity mismatch");
    const { error } = await db.rpc("confirm_experiment_audio", { p_uid: body.uid, p_session_id: body.sessionId,
      p_secret_hash: hashSessionSecret(body.sessionSecret), p_recording_id: a.recordingId });
    if (error) throw new Error("Recording confirmation failed");
    return NextResponse.json({ uploaded: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof SessionAccessError ? e.message : "尚未确认录音上传成功。原录音保留在本机，请重试或改用文字。" }, { status: e instanceof SessionAccessError ? e.status : 500 });
  }
}
