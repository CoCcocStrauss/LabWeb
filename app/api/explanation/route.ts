import { NextResponse } from "next/server";
import {
  authorizeSessionRecord,
  hashSessionSecret,
  SessionAccessError,
} from "../../lib/serverSession";
import { readRequestJson } from "../../lib/submissionValidation";
import { validExplanation, secretIsValid } from "../../lib/posttestValidation";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const value = await readRequestJson(request);
    if (!value || typeof value !== "object")
      return NextResponse.json(
        { error: "Invalid explanation" },
        { status: 400 },
      );
    const b = value as Record<string, unknown>;
    if (
      typeof b.uid !== "string" ||
      b.uid.length < 1 ||
      b.uid.length > 200 ||
      typeof b.sessionId !== "string" ||
      !secretIsValid(b.sessionSecret) ||
      !validExplanation(b.explanation, b.sessionId)
    )
      return NextResponse.json(
        { error: "Invalid explanation" },
        { status: 400 },
      );
    const identity = {
      uid: b.uid,
      sessionId: b.sessionId,
      sessionSecret: b.sessionSecret,
    };
    const { db, questionnaireVersion } = await authorizeSessionRecord(identity);
    const { error } = await db.rpc(
      questionnaireVersion === "2026-11-24-v4"
        ? "save_experiment_explanation_v6"
        : questionnaireVersion === "2026-11-23-reasons-v1"
          ? "save_experiment_explanation_v5"
          : "save_experiment_explanation_v4",
      {
        p_uid: b.uid,
        p_session_id: b.sessionId,
        p_secret_hash: hashSessionSecret(b.sessionSecret),
        p_explanation: b.explanation,
      },
    );
    if (error) throw new Error("save failed");
    return NextResponse.json(
      { saved: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof SessionAccessError
            ? e.message
            : "本题暂时未能保存，内容已保留，请通过提交按钮重试。",
      },
      { status: e instanceof SessionAccessError ? e.status : 500 },
    );
  }
}
