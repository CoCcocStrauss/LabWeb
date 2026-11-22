import type {
  ReadingMetrics,
  RulesResponse,
  MicrophonePermission,
  InteractionContext,
} from "./readingProtocol";
import type { TopicKey } from "../data/topics";
import type { Quality, SourceLevel, Stance } from "./blockRandomize";
import type {
  ComprehensionAttempt,
  QuestionnaireResponse,
} from "../data/questionnaire";
import type {
  ExplanationResponse,
  Interruption,
  PresentedPost,
  RecognitionResponse,
  ReasonsResponse,
} from "./posttest";
import type { ReasonResponse } from "../protocol/v4/lib/reasons";
import type { InteractionComparison } from "../protocol/v4/lib/interactionComparison";

export type EndReason = "manual" | "timeout";

export type PostExperimentAttrs = {
  stance: Stance;
  sourceLevel: SourceLevel;
  quality: Quality;
};

export type ActionLog =
  | ({
      interaction?: InteractionContext;
      type: "share";
      postId: string;
      timestamp: number;
      order: number;
    } & PostExperimentAttrs)
  | ({
      interaction?: InteractionContext;
      type: "like";
      postId: string;
      timestamp: number;
    } & PostExperimentAttrs)
  | ({
      interaction?: InteractionContext;
      type: "unlike";
      postId: string;
      timestamp: number;
    } & PostExperimentAttrs)
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
  sessionId: string;
  sessionSecret: string;
  rules: RulesResponse;
  microphonePermission: MicrophonePermission;
  readingMetrics: ReadingMetrics;
  questionnaireVersion: string;
  pretest: QuestionnaireResponse;
  posttest: QuestionnaireResponse;
  comprehension: ComprehensionAttempt[];
  recognition: RecognitionResponse;
  explanation: ExplanationResponse;
  reasons: ReasonsResponse | null;
  preReasons?: ReasonResponse;
  postReasons?: ReasonResponse;
  interactionComparison?: InteractionComparison;
  presentedPosts: PresentedPost[];
  interruptions: Interruption[];
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

export type PretestInput = Pick<
  SubmitExperimentDataInput,
  | "uid"
  | "conditionN"
  | "topicKey"
  | "sessionId"
  | "sessionSecret"
  | "questionnaireVersion"
  | "pretest"
  | "microphonePermission"
  | "preReasons"
>;

export async function postJson<T>(
  url: string,
  input: unknown,
  timeoutMs = 15_000,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signal: controller.signal,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error ?? `保存失败（${res.status}）`);
    return data as T;
  } finally {
    clearTimeout(timeout);
  }
}

export async function savePretest(input: PretestInput): Promise<void> {
  const result = await postJson<{ saved: boolean }>("/api/progress", input);
  if (result.saved !== true) throw new Error("保存结果不完整，请重试。");
}

/**
 * 提交实验数据：POST 到服务端 /api/submit，由服务端用 service role key
 * 写入 Supabase（原子 RPC，四张表一次性写完）。完成码由服务端生成，
 * 浏览器端不再持有 Supabase 的任何写权限。
 */
export async function submitExperimentData(
  input: SubmitExperimentDataInput,
): Promise<string> {
  const data = await postJson<{ completionCode: string }>("/api/submit", input);
  if (typeof data.completionCode !== "string" || !data.completionCode)
    throw new Error("保存结果不完整，请重试。");
  return data.completionCode;
}
