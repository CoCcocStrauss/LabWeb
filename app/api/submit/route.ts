import { NextResponse } from "next/server";

import { TOPIC_KEYS, type TopicKey } from "../../data/topics";
import {
  generateCompletionCode,
  type ActionLog,
  type EndReason,
  type PostVisibilitySummary,
  type ScrollEvent,
} from "../../lib/dataSubmit";
import { getSupabaseAdmin } from "../../lib/supabaseAdmin";

export const runtime = "nodejs";

const VALID_CONDITION_N = [8, 16, 48];
const VALID_END_REASONS: EndReason[] = ["manual", "timeout"];
const VALID_ACTION_TYPES = ["share", "like", "unlike", "user_post"];
const MAX_SHARE_COUNT = 2;

type SubmitBody = {
  uid: string;
  conditionN: number;
  topic: string;
  topicKey: TopicKey;
  startTime: number;
  endTime: number;
  endReason: EndReason;
  maxScrollY: number;
  postOrder: string[];
  actions: ActionLog[];
  scrollEvents: ScrollEvent[];
  postVisibilitySummary: PostVisibilitySummary;
};

function isValidBody(body: unknown): body is SubmitBody {
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;

  if (typeof b.uid !== "string" || b.uid.trim().length === 0) return false;
  if (
    typeof b.conditionN !== "number" ||
    !VALID_CONDITION_N.includes(b.conditionN)
  )
    return false;
  if (typeof b.topic !== "string" || b.topic.length === 0) return false;
  if (
    typeof b.topicKey !== "string" ||
    !(TOPIC_KEYS as readonly string[]).includes(b.topicKey)
  )
    return false;
  if (typeof b.startTime !== "number" || typeof b.endTime !== "number")
    return false;
  if (b.endTime < b.startTime) return false;
  if (
    typeof b.endReason !== "string" ||
    !VALID_END_REASONS.includes(b.endReason as EndReason)
  )
    return false;
  if (typeof b.maxScrollY !== "number" || b.maxScrollY < 0) return false;
  if (
    !Array.isArray(b.postOrder) ||
    !b.postOrder.every((p) => typeof p === "string")
  )
    return false;
  if (!Array.isArray(b.actions) || !Array.isArray(b.scrollEvents))
    return false;
  if (typeof b.postVisibilitySummary !== "object" || b.postVisibilitySummary === null)
    return false;

  let shareCount = 0;
  for (const a of b.actions) {
    if (!a || typeof a !== "object") return false;
    const type = (a as Record<string, unknown>).type;
    if (typeof type !== "string" || !VALID_ACTION_TYPES.includes(type)) {
      return false;
    }
    if (type === "share") shareCount += 1;
  }
  if (shareCount > MAX_SHARE_COUNT) return false;

  for (const e of b.scrollEvents) {
    if (!e || typeof e !== "object") return false;
    const action = (e as Record<string, unknown>).action;
    if (action !== "enter_viewport" && action !== "leave_viewport") {
      return false;
    }
  }

  return true;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!isValidBody(body)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const completionCode = generateCompletionCode();
  const totalDurationMs = Math.max(0, body.endTime - body.startTime);

  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.rpc("submit_experiment", {
      p_uid: body.uid,
      p_condition_n: body.conditionN,
      p_topic: body.topic,
      p_topic_key: body.topicKey,
      p_start_time_ms: body.startTime,
      p_end_time_ms: body.endTime,
      p_total_duration_ms: totalDurationMs,
      p_completion_code: completionCode,
      p_end_reason: body.endReason,
      p_max_scroll_y: body.maxScrollY,
      p_post_order: body.postOrder,
      p_actions: body.actions,
      p_scroll_events: body.scrollEvents,
      p_post_visibility: body.postVisibilitySummary,
    });

    if (error) {
      const isDuplicate = error.code === "23505";
      console.error("submit_experiment failed:", error);
      return NextResponse.json(
        { error: isDuplicate ? "Duplicate submission" : "Database error" },
        { status: isDuplicate ? 409 : 500 }
      );
    }

    return NextResponse.json({ completionCode });
  } catch (e) {
    console.error("submit_experiment unexpected error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
