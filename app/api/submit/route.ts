import { validSubmission as validLatest } from "../../protocol/v5/lib/submissionValidation";
import { validSubmission as validV4Submission } from "../../protocol/v4/lib/submissionValidation";
import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { generateCompletionCode } from "../../lib/dataSubmit";
import {
  canonicalJson,
  readRequestJson,
  validSubmission,
} from "../../lib/submissionValidation";
import { getSupabaseAdmin } from "../../lib/supabaseAdmin";
import { validSubmission as validLegacySubmission } from "../../legacy/submissionValidation";
import { validSubmission as validV2Submission } from "../../compat/v2/lib/submissionValidation";
import { hashSessionSecret } from "../../lib/serverSession";

export const runtime = "nodejs";
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await readRequestJson(request);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const latest = validLatest(body);
  const v4 = validV4Submission(body);
  const legacy = validLegacySubmission(body);
  const v2 = validV2Submission(body);
  if (
    !latest &&
    !v4 &&
    !validSubmission(body) &&
    !validV2Submission(body) &&
    !validLegacySubmission(body)
  )
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  const { sessionSecret, ...payload } = body as typeof body & {
    sessionSecret?: string;
  };
  const digest = createHash("sha256")
    .update(canonicalJson(payload))
    .digest("hex");
  try {
    const { data, error } = await getSupabaseAdmin().rpc(
      latest
        ? "submit_experiment_v6"
        : v4
          ? "submit_experiment_v5"
          : legacy
            ? "submit_experiment_v2"
            : v2
              ? "submit_experiment_v3"
              : "submit_experiment_v4",
      {
        p_payload: payload,
        p_payload_hash: digest,
        p_completion_code: generateCompletionCode(),
        ...(!legacy
          ? { p_secret_hash: hashSessionSecret(sessionSecret!) }
          : {}),
      },
    );
    if (error) {
      console.error("experiment submission failed:", error.code);
      return NextResponse.json(
        {
          error:
            error.code === "23505"
              ? "此 UID 已有另一份记录，请联系实验员。"
              : "暂时无法保存，请稍后重试。",
        },
        { status: error.code === "23505" ? 409 : 500 },
      );
    }
    return NextResponse.json({ completionCode: data });
  } catch {
    return NextResponse.json(
      { error: "暂时无法保存，请稍后重试。" },
      { status: 500 },
    );
  }
}
