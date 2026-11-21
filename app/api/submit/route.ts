import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { generateCompletionCode } from "../../lib/dataSubmit";
import { canonicalJson, readRequestJson, validSubmission } from "../../lib/submissionValidation";
import { getSupabaseAdmin } from "../../lib/supabaseAdmin";
import { validSubmission as validLegacySubmission } from "../../legacy/submissionValidation";
import { hashSessionSecret } from "../../lib/serverSession";

export const runtime = "nodejs";
export async function POST(request: Request) {
  let body: unknown;
  try { body = await readRequestJson(request); }
  catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }
  const legacy = validLegacySubmission(body);
  if (!validSubmission(body) && !legacy) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  const { sessionSecret, ...payload } = body as typeof body & { sessionSecret?: string };
  const digest = createHash("sha256").update(canonicalJson(payload)).digest("hex");
  try {
    const { data, error } = await getSupabaseAdmin().rpc(legacy ? "submit_experiment_v2" : "submit_experiment_v3", {
      p_payload: payload, p_payload_hash: digest, p_completion_code: generateCompletionCode(),
      ...(!legacy ? { p_secret_hash: hashSessionSecret(sessionSecret!) } : {}),
    });
    if (error) {
      console.error("experiment submission failed:", error.code);
      return NextResponse.json({ error: error.code === "23505" ? "此 UID 已有另一份记录，请联系实验员。" : "暂时无法保存，请稍后重试。" }, { status: error.code === "23505" ? 409 : 500 });
    }
    return NextResponse.json({ completionCode: data });
  } catch {
    return NextResponse.json({ error: "暂时无法保存，请稍后重试。" }, { status: 500 });
  }
}
