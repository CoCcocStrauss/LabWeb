import {
  newRules,
  newPermission,
  type RulesResponse,
  type MicrophonePermission,
  type ReadingMetrics,
} from "./readingProtocol";
import {
  QUESTIONNAIRE_VERSION,
  emptyResponse,
  getQuestions,
  type ComprehensionAttempt,
  type QuestionnaireResponse,
  type QuestionnaireStage,
} from "../data/questionnaire";
import type { TopicKey } from "../data/topics";
import type {
  ExplanationResponse,
  Interruption,
  RecognitionResponse,
  ReasonsResponse,
} from "./posttest";
import type { ConditionN } from "./conditionAssignment";
import type {
  ActionLog,
  PostVisibilitySummary,
  ScrollEvent,
  SubmitExperimentDataInput,
} from "./dataSubmit";
import type { PostItemWithDisplay } from "./enrichPosts";

export const READING_DURATION_MS = 90_000;
export type ReadingSnapshot = {
  posts: PostItemWithDisplay[];
  startTime: number;
  deadline: number;
  savedAt: number;
  metrics?: ReadingMetrics;
  actions: ActionLog[];
  scrollEvents: ScrollEvent[];
  postVisibilitySummary: PostVisibilitySummary;
  maxScrollY: number;
  scrollY: number;
  userPostDraft: string;
  ownPost: { content: string; displayName: string } | null;
  insertBeforePostId: string | null;
};
export type ReadingEndData = Pick<
  SubmitExperimentDataInput,
  | "uid"
  | "conditionN"
  | "topic"
  | "topicKey"
  | "startTime"
  | "endTime"
  | "endReason"
  | "maxScrollY"
  | "postOrder"
  | "actions"
  | "scrollEvents"
  | "postVisibilitySummary"
  | "presentedPosts"
  | "readingMetrics"
>;
export type Phase =
  | "entry"
  | "pretest"
  | "pretest_save"
  | "tutorial"
  | "comprehension"
  | "ready"
  | "experiment"
  | "recognition"
  | "posttest"
  | "explanation"
  | "reasons"
  | "post_museum"
  | "submitting"
  | "complete";
export type ExperimentSession = {
  schemaVersion: 3;
  questionnaireVersion: typeof QUESTIONNAIRE_VERSION;
  sessionId: string;
  sessionSecret: string;
  rules: RulesResponse;
  microphonePermission: MicrophonePermission;
  uid: string;
  conditionN: ConditionN;
  topicKey: TopicKey;
  returnUrl: string | null;
  phase: Phase;
  pretest: QuestionnaireResponse;
  comprehension: ComprehensionAttempt[];
  reading: ReadingSnapshot | null;
  endData: ReadingEndData | null;
  posttest: QuestionnaireResponse | null;
  completionCode: string | null;
  recognition: RecognitionResponse | null;
  explanation: ExplanationResponse | null;
  reasons: ReasonsResponse | null;
  interruptions: Interruption[];
};

export function createSession(params: {
  uid: string;
  conditionN: ConditionN;
  topic: TopicKey;
  returnUrl: string | null;
}): ExperimentSession {
  return {
    schemaVersion: 3,
    questionnaireVersion: QUESTIONNAIRE_VERSION,
    sessionId: crypto.randomUUID(),
    sessionSecret: Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
      b.toString(16).padStart(2, "0"),
    ).join(""),
    uid: params.uid,
    conditionN: params.conditionN,
    topicKey: params.topic,
    returnUrl: params.returnUrl,
    phase: "entry",
    rules: newRules(),
    microphonePermission: newPermission(),
    pretest: emptyResponse("pretest"),
    comprehension: [],
    reading: null,
    endData: null,
    posttest: null,
    completionCode: null,
    recognition: null,
    explanation: null,
    reasons: null,
    interruptions: [],
  };
}

export function storageKey(uid: string): string {
  return `labweb:session:v3:${encodeURIComponent(uid)}`;
}

export function saveSession(session: ExperimentSession): void {
  localStorage.setItem(storageKey(session.uid), JSON.stringify(session));
}

function validDraft(
  response: QuestionnaireResponse | null,
  topic: TopicKey,
  stage: QuestionnaireStage,
): boolean {
  if (
    !response ||
    response.stage !== stage ||
    !Number.isSafeInteger(response.startedAt) ||
    response.startedAt <= 0 ||
    !Array.isArray(response.answers)
  )
    return false;
  const questions = getQuestions(topic, stage);
  if (response.answers.length > questions.length) return false;
  let previous = response.startedAt;
  for (let i = 0; i < response.answers.length; i++) {
    const answer = response.answers[i];
    if (
      !answer ||
      answer.questionId !== questions[i].id ||
      !Number.isInteger(answer.value) ||
      answer.value < 1 ||
      answer.value > questions[i].options.length ||
      !Number.isSafeInteger(answer.startedAt) ||
      !Number.isSafeInteger(answer.answeredAt) ||
      answer.startedAt < previous ||
      answer.answeredAt < answer.startedAt
    )
      return false;
    previous = answer.answeredAt;
  }
  return response.answers.length === questions.length
    ? typeof response.completedAt === "number" &&
        Number.isSafeInteger(response.completedAt) &&
        response.completedAt >= previous
    : response.completedAt === null;
}

export class LegacySessionError extends Error {}
export class V2SessionError extends Error {}

export function loadSession(uid: string): ExperimentSession | null {
  const raw = localStorage.getItem(storageKey(uid));
  if (raw === null) {
    if (
      localStorage.getItem(`labweb:session:v2:${encodeURIComponent(uid)}`) !==
      null
    )
      throw new V2SessionError("v2进度");
    if (
      localStorage.getItem(`labweb:session:v1:${encodeURIComponent(uid)}`) !==
      null
    )
      throw new LegacySessionError("旧版本进度");
    return null;
  }
  const invalid = () =>
    new Error(
      "无法读取已保存的进度。请保留此页面并联系实验员，不要清除浏览器数据。",
    );
  let s: ExperimentSession;
  try {
    s = JSON.parse(raw) as ExperimentSession;
  } catch {
    throw invalid();
  }
  if (
    !s ||
    s.schemaVersion !== 3 ||
    s.questionnaireVersion !== QUESTIONNAIRE_VERSION ||
    s.uid !== uid ||
    typeof s.sessionId !== "string" ||
    !/^[a-f0-9]{64}$/.test(s.sessionSecret) ||
    !Array.isArray(s.interruptions) ||
    ![8, 16, 48].includes(s.conditionN) ||
    !["ai", "fertility"].includes(s.topicKey) ||
    ![
      "entry",
      "pretest",
      "pretest_save",
      "tutorial",
      "comprehension",
      "ready",
      "experiment",
      "recognition",
      "posttest",
      "explanation",
      "reasons",
      "post_museum",
      "submitting",
      "complete",
    ].includes(s.phase) ||
    !validDraft(s.pretest, s.topicKey, "pretest") ||
    !Array.isArray(s.comprehension)
  )
    throw invalid();
  if (
    s.comprehension.some(
      (a, i) =>
        !a ||
        !Number.isInteger(a.value) ||
        a.value < 1 ||
        a.value > 3 ||
        a.correct !== (a.value === 1) ||
        !Number.isSafeInteger(a.timestamp) ||
        (a.correct && i !== s.comprehension.length - 1),
    )
  )
    throw invalid();
  if (!["entry", "pretest"].includes(s.phase) && !s.pretest.completedAt)
    throw invalid();
  if (
    [
      "ready",
      "experiment",
      "recognition",
      "posttest",
      "explanation",
      "reasons",
      "post_museum",
      "submitting",
      "complete",
    ].includes(s.phase) &&
    !s.comprehension.at(-1)?.autoAdvancedAt
  )
    throw invalid();
  if (s.reading) {
    const r = s.reading;
    if (
      !Array.isArray(r.posts) ||
      r.posts.length !== s.conditionN ||
      r.posts.some(
        (p) =>
          !p ||
          typeof p.id !== "string" ||
          typeof p.content !== "string" ||
          typeof p.displayName !== "string",
      ) ||
      new Set(r.posts.map((p) => p.id)).size !== s.conditionN ||
      !Number.isSafeInteger(r.startTime) ||
      r.deadline !== r.startTime + READING_DURATION_MS ||
      !Number.isSafeInteger(r.savedAt) ||
      r.savedAt < r.startTime ||
      r.savedAt > r.deadline ||
      !Array.isArray(r.actions) ||
      r.actions.some(
        (a) => !a || !["like", "unlike", "share", "user_post"].includes(a.type),
      ) ||
      !Array.isArray(r.scrollEvents) ||
      !r.postVisibilitySummary ||
      typeof r.postVisibilitySummary !== "object" ||
      Array.isArray(r.postVisibilitySummary) ||
      !Number.isFinite(r.scrollY) ||
      r.scrollY < 0 ||
      !Number.isFinite(r.maxScrollY) ||
      r.maxScrollY < 0 ||
      typeof r.userPostDraft !== "string" ||
      (r.ownPost !== null &&
        (!r.ownPost ||
          typeof r.ownPost.content !== "string" ||
          typeof r.ownPost.displayName !== "string"))
    )
      throw invalid();
  }
  if (s.phase === "experiment" && !s.reading) throw invalid();
  if (
    [
      "posttest",
      "explanation",
      "reasons",
      "post_museum",
      "submitting",
      "complete",
    ].includes(s.phase) &&
    (!s.endData ||
      !validDraft(s.posttest, s.topicKey, "posttest") ||
      s.endData.uid !== uid ||
      s.endData.conditionN !== s.conditionN ||
      s.endData.topicKey !== s.topicKey)
  )
    throw invalid();
  if (["submitting", "complete"].includes(s.phase) && !s.posttest?.completedAt)
    throw invalid();
  if (
    [
      "recognition",
      "posttest",
      "explanation",
      "reasons",
      "post_museum",
      "submitting",
      "complete",
    ].includes(s.phase) &&
    (!s.recognition || !Array.isArray(s.recognition.options))
  )
    throw invalid();
  if (
    [
      "explanation",
      "reasons",
      "post_museum",
      "submitting",
      "complete",
    ].includes(s.phase) &&
    (!s.explanation || typeof s.explanation.text !== "string")
  )
    throw invalid();
  if (
    ["reasons", "post_museum", "submitting", "complete"].includes(s.phase) &&
    (!s.reasons ||
      !Array.isArray(s.reasons.order) ||
      !Array.isArray(s.reasons.selected))
  )
    throw invalid();
  if (!s.rules || !Array.isArray(s.rules.items) || !s.microphonePermission)
    throw invalid();
  return s;
}

export function remainingReadingMs(
  reading: Pick<ReadingSnapshot, "deadline">,
  now = Date.now(),
): number {
  return Math.max(0, reading.deadline - now);
}

export function readingEndData(
  session: Pick<ExperimentSession, "uid" | "conditionN" | "topicKey">,
  reading: ReadingSnapshot,
  endTime: number,
  endReason: "manual" | "timeout",
  title: string,
): ReadingEndData {
  return {
    uid: session.uid,
    conditionN: session.conditionN,
    topic: title,
    topicKey: session.topicKey,
    startTime: reading.startTime,
    endTime: Math.min(endTime, reading.deadline),
    endReason,
    maxScrollY: reading.maxScrollY,
    postOrder: reading.posts.map((p) => p.id),
    actions: reading.actions,
    scrollEvents: reading.scrollEvents,
    postVisibilitySummary: reading.postVisibilitySummary,
    readingMetrics: reading.metrics!,
    presentedPosts: reading.posts.map((p) => ({
      postId: p.id,
      displayName: p.displayName,
      avatarFile: p.avatarFile ?? null,
      identityLabel: p.identityLabel ?? null,
      platformLabel: p.platformLabel ?? null,
    })),
  };
}

export function finalPayload(
  session: ExperimentSession,
): SubmitExperimentDataInput {
  if (
    !session.endData ||
    !session.posttest?.completedAt ||
    !session.pretest.completedAt ||
    !session.recognition ||
    !session.explanation?.completedAt ||
    !session.reasons?.completedAt
  )
    throw new Error("问卷尚未完成");
  return {
    ...session.endData,
    sessionId: session.sessionId,
    sessionSecret: session.sessionSecret,
    questionnaireVersion: session.questionnaireVersion,
    rules: session.rules,
    microphonePermission: session.microphonePermission,
    pretest: session.pretest,
    posttest: session.posttest,
    comprehension: session.comprehension,
    recognition: session.recognition,
    explanation: session.explanation,
    reasons: session.reasons,
    interruptions: session.interruptions,
  };
}
