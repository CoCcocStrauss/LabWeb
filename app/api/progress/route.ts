import { NextResponse } from "next/server";
import { readRequestJson, validPretest } from "../../lib/submissionValidation";
import { validPretest as validV2 } from "../../compat/v2/lib/submissionValidation";
import { validPretest as validV1 } from "../../legacy/submissionValidation";
import { hashSessionSecret } from "../../lib/serverSession";
import { getSupabaseAdmin } from "../../lib/supabaseAdmin";
export const runtime = "nodejs";
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await readRequestJson(request);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const v1 = validV1(body),
    v2 = validV2(body);
  if (!validPretest(body) && !validV2(body) && !validV1(body))
    return NextResponse.json({ error: "Invalid pretest" }, { status: 400 });
  try {
    const { error } = await getSupabaseAdmin().rpc(
      v1
        ? "save_experiment_pretest"
        : v2
          ? "save_experiment_pretest_v3"
          : "save_experiment_pretest_v4",
      {
        p_uid: body.uid,
        p_session_id: body.sessionId,
        p_condition_n: body.conditionN,
        p_topic_key: body.topicKey,
        p_questionnaire_version: body.questionnaireVersion,
        p_pretest: body.pretest,
        ...(!v1 && "sessionSecret" in body
          ? { p_secret_hash: hashSessionSecret(body.sessionSecret as string) }
          : {}),
        ...(validPretest(body)
          ? { p_permission_check: body.microphonePermission }
          : {}),
      },
    );
    if (error) {
      console.error("pretest save failed:", error.code);
      return NextResponse.json(
        {
          error:
            error.code === "23505"
              ? "此UID已有另一份记录，请联系实验员。"
              : "暂时无法保存，请稍后重试。",
        },
        { status: error.code === "23505" ? 409 : 500 },
      );
    }
    return NextResponse.json(
      { saved: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "暂时无法保存，请稍后重试。" },
      { status: 500 },
    );
  }
}
