import { NextResponse } from "next/server";
import { readRequestJson, validPretest } from "../../lib/submissionValidation";
import { getSupabaseAdmin } from "../../lib/supabaseAdmin";
import { validPretest as validLegacyPretest } from "../../legacy/submissionValidation";
import { hashSessionSecret } from "../../lib/serverSession";

export const runtime = "nodejs";
export async function POST(request: Request) {
  let body: unknown;
  try { body = await readRequestJson(request); }
  catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }
  const legacy = validLegacyPretest(body);
  if (!validPretest(body) && !validLegacyPretest(body)) return NextResponse.json({ error: "Invalid pretest" }, { status: 400 });
  try {
    const { error } = await getSupabaseAdmin().rpc(legacy ? "save_experiment_pretest" : "save_experiment_pretest_v3", {
      p_uid: body.uid, p_session_id: body.sessionId, p_condition_n: body.conditionN,
      p_topic_key: body.topicKey, p_questionnaire_version: body.questionnaireVersion, p_pretest: body.pretest,
      ...(!legacy && "sessionSecret" in body ? { p_secret_hash: hashSessionSecret(body.sessionSecret as string) } : {}),
    });
    if (error) {
      console.error("pretest save failed:", error.code);
      return NextResponse.json({ error: error.code === "23505" ? "此 UID 已有另一份记录，请联系实验员。" : "暂时无法保存，请稍后重试。" }, { status: error.code === "23505" ? 409 : 500 });
    }
    return NextResponse.json({ saved: true });
  } catch {
    return NextResponse.json({ error: "暂时无法保存，请稍后重试。" }, { status: 500 });
  }
}
