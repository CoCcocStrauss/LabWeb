import { validPretest as validLatest } from "../../protocol/v5/lib/submissionValidation";
import { validPretest as validV4 } from "../../protocol/v4/lib/submissionValidation";
import { NextResponse } from "next/server";
import { readRequestJson, validPretest } from "../../lib/submissionValidation";
import { validPretest as validV2 } from "../../compat/v2/lib/submissionValidation";
import { validPretest as validV1 } from "../../legacy/submissionValidation";
import { hashSessionSecret } from "../../lib/serverSession";
import { getSupabaseAdmin } from "../../lib/supabaseAdmin";
import type { PretestInput } from "../../lib/dataSubmit";
export const runtime = "nodejs";
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await readRequestJson(request);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const latest = validLatest(body),
    v4 = validV4(body),
    v1 = validV1(body),
    v2 = validV2(body);
  if (!latest && !v4 && !validPretest(body) && !validV2(body) && !validV1(body))
    return NextResponse.json({ error: "Invalid pretest" }, { status: 400 });
  const input = body as PretestInput;
  try {
    const { error } = await getSupabaseAdmin().rpc(
      latest
        ? "save_experiment_pretest_v6"
        : v4
          ? "save_experiment_pretest_v5"
          : v1
            ? "save_experiment_pretest"
            : v2
              ? "save_experiment_pretest_v3"
              : "save_experiment_pretest_v4",
      {
        p_uid: input.uid,
        p_session_id: input.sessionId,
        p_condition_n: input.conditionN,
        p_topic_key: input.topicKey,
        p_questionnaire_version: input.questionnaireVersion,
        p_pretest: input.pretest,
        ...(!v1 && "sessionSecret" in input
          ? { p_secret_hash: hashSessionSecret(input.sessionSecret as string) }
          : {}),
        ...(latest || v4 || validPretest(input)
          ? {
              p_permission_check: input.microphonePermission,
              ...(v4 ? { p_pre_reasons: input.preReasons } : {}),
            }
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
