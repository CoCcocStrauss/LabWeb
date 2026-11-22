import { createHash, timingSafeEqual } from "node:crypto";
import { QUESTIONNAIRE_VERSION } from "../data/questionnaire";
import { secretIsValid } from "./posttestValidation";
import { getSupabaseAdmin } from "./supabaseAdmin";

export const hashSessionSecret = (secret: string) =>
  createHash("sha256").update(secret).digest("hex");
export class SessionAccessError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function authorizeSessionRecord(body: {
  uid: string;
  sessionId: string;
  sessionSecret: string;
}) {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from("experiment_sessions")
    .select("session_id,session_secret_hash,questionnaire_version,completed_at")
    .eq("uid", body.uid)
    .maybeSingle();
  if (error)
    throw new SessionAccessError(500, "暂时无法确认录音权限，请稍后重试。");
  const expected = data?.session_secret_hash;
  const actual = hashSessionSecret(body.sessionSecret);
  if (
    !data ||
    data.session_id !== body.sessionId ||
    ![QUESTIONNAIRE_VERSION, "2026-11-21-v2", "2026-11-23-reasons-v1"].includes(
      data.questionnaire_version,
    ) ||
    !secretIsValid(expected) ||
    !timingSafeEqual(Buffer.from(expected), Buffer.from(actual))
  )
    throw new SessionAccessError(403, "录音会话无效，请联系实验员。");
  if (data.completed_at)
    throw new SessionAccessError(409, "本部分已经提交，请勿重复上传录音。");
  return { db, questionnaireVersion: data.questionnaire_version as string };
}

export async function authorizeSession(body: {
  uid: string;
  sessionId: string;
  sessionSecret: string;
}) {
  return (await authorizeSessionRecord(body)).db;
}
