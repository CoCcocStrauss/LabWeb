import { secretIsValid, validAudioMetadata } from "./posttestValidation";
import type { AudioMetadata } from "./posttest";
export type AudioRequest = { uid: string; sessionId: string; sessionSecret: string; recording: AudioMetadata };
export function validAudioRequest(body: unknown): body is AudioRequest {
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  return typeof b.uid === "string" && b.uid.trim() === b.uid && b.uid.length > 0 && b.uid.length <= 200 &&
    typeof b.sessionId === "string" && /^[a-f0-9-]{36}$/.test(b.sessionId) && secretIsValid(b.sessionSecret) && validAudioMetadata(b.recording);
}
