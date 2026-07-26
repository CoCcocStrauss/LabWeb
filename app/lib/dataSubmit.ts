import type { TopicKey } from "../data/topics";
import type { Quality, SourceLevel, Stance } from "./blockRandomize";

export type EndReason = "manual" | "timeout";

export type PostExperimentAttrs = {
  stance: Stance;
  sourceLevel: SourceLevel;
  quality: Quality;
};

export type ActionLog =
  | {
      type: "share";
      postId: string;
      timestamp: number;
      order: number;
    } & PostExperimentAttrs
  | ({ type: "like"; postId: string; timestamp: number } & PostExperimentAttrs)
  | ({ type: "unlike"; postId: string; timestamp: number } & PostExperimentAttrs)
  | {
      type: "user_post";
      content: string;
      timestamp: number;
      charCount: number;
    };

export type ScrollEvent = {
  postId: string;
  action: "enter_viewport" | "leave_viewport";
  timestamp: number;
  scrollY: number;
};

export type PostVisibilityEntry = {
  totalVisibleMs: number;
  firstSeenAt: number | null;
};

export type PostVisibilitySummary = Record<string, PostVisibilityEntry>;

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** 生成 6 位随机完成码（排除易混淆字符 0/O/1/I）。仅在服务端（API 路由）调用。 */
export function generateCompletionCode(length = 6): string {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]!;
  }
  return code;
}

export type SubmitExperimentDataInput = {
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

type SubmitResponse = { completionCode: string };
type SubmitErrorResponse = { error: string };

/**
 * 提交实验数据：POST 到服务端 /api/submit，由服务端用 service role key
 * 写入 Supabase（原子 RPC，四张表一次性写完）。完成码由服务端生成，
 * 浏览器端不再持有 Supabase 的任何写权限。
 */
export async function submitExperimentData(
  input: SubmitExperimentDataInput
): Promise<string> {
  const res = await fetch("/api/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const errorBody = (await res.json().catch(() => null)) as
      | SubmitErrorResponse
      | null;
    throw new Error(errorBody?.error ?? `提交失败（状态码 ${res.status}）`);
  }

  const data = (await res.json()) as SubmitResponse;
  return data.completionCode;
}
