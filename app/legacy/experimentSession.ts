// 旧问卷v1兼容路径：保留原始题序、原始答案及恢复行为。
import { QUESTIONNAIRE_VERSION, emptyResponse, getQuestions, type ComprehensionAttempt, type QuestionnaireResponse, type QuestionnaireStage } from "./questionnaire";
import type { TopicKey } from "../data/topics";
import type { ConditionN } from "../lib/conditionAssignment";
import type { ActionLog, PostVisibilitySummary, ScrollEvent, SubmitExperimentDataInput } from "./dataSubmit";
import type { PostItemWithDisplay } from "../lib/enrichPosts";

export const READING_DURATION_MS = 90_000;
export type ReadingSnapshot = {
  posts: PostItemWithDisplay[];
  startTime: number;
  deadline: number;
  savedAt: number;
  actions: ActionLog[];
  scrollEvents: ScrollEvent[];
  postVisibilitySummary: PostVisibilitySummary;
  maxScrollY: number;
  scrollY: number;
  userPostDraft: string;
  ownPost: { content: string; displayName: string } | null;
  insertBeforePostId: string | null;
};
export type ReadingEndData = Pick<SubmitExperimentDataInput, "uid" | "conditionN" | "topic" | "topicKey" | "startTime" | "endTime" | "endReason" | "maxScrollY" | "postOrder" | "actions" | "scrollEvents" | "postVisibilitySummary">;
export type Phase = "pretest" | "pretest_save" | "tutorial" | "comprehension" | "ready" | "experiment" | "posttest" | "submitting" | "complete";
export type ExperimentSession = {
  schemaVersion: 1;
  questionnaireVersion: typeof QUESTIONNAIRE_VERSION;
  sessionId: string;
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
};

export function createSession(params: { uid: string; conditionN: ConditionN; topic: TopicKey; returnUrl: string | null }): ExperimentSession {
  return { schemaVersion: 1, questionnaireVersion: QUESTIONNAIRE_VERSION, sessionId: crypto.randomUUID(),
    uid: params.uid, conditionN: params.conditionN, topicKey: params.topic, returnUrl: params.returnUrl,
    phase: "pretest", pretest: emptyResponse("pretest"), comprehension: [], reading: null,
    endData: null, posttest: null, completionCode: null };
}

export function storageKey(uid: string): string { return `labweb:session:v1:${encodeURIComponent(uid)}`; }

export function saveSession(session: ExperimentSession): void {
  localStorage.setItem(storageKey(session.uid), JSON.stringify(session));
}

function validDraft(response: QuestionnaireResponse | null, topic: TopicKey, stage: QuestionnaireStage): boolean {
  if (!response || response.stage !== stage || !Number.isSafeInteger(response.startedAt) || response.startedAt <= 0 || !Array.isArray(response.answers)) return false;
  const questions = getQuestions(topic, stage);
  if (response.answers.length > questions.length) return false;
  let previous = response.startedAt;
  for (let i = 0; i < response.answers.length; i++) {
    const answer = response.answers[i];
    if (!answer || answer.questionId !== questions[i].id || !Number.isInteger(answer.value) || answer.value < 1 || answer.value > 5 ||
        !Number.isSafeInteger(answer.startedAt) || !Number.isSafeInteger(answer.answeredAt) || answer.startedAt < previous || answer.answeredAt < answer.startedAt) return false;
    previous = answer.answeredAt;
  }
  return response.answers.length === questions.length
    ? typeof response.completedAt === "number" && Number.isSafeInteger(response.completedAt) && response.completedAt >= previous
    : response.completedAt === null;
}

export function loadSession(uid: string): ExperimentSession | null {
  const raw = localStorage.getItem(storageKey(uid));
  if (raw === null) return null;
  const invalid = () => new Error("无法读取已保存的进度。请保留此页面并联系实验员，不要清除浏览器数据。");
  let s: ExperimentSession;
  try { s = JSON.parse(raw) as ExperimentSession; } catch { throw invalid(); }
  if (!s || s.schemaVersion !== 1 || s.questionnaireVersion !== QUESTIONNAIRE_VERSION || s.uid !== uid ||
      typeof s.sessionId !== "string" || ![8, 16, 48].includes(s.conditionN) ||
      !["ai", "fertility"].includes(s.topicKey) ||
      !["pretest", "pretest_save", "tutorial", "comprehension", "ready", "experiment", "posttest", "submitting", "complete"].includes(s.phase) ||
      !validDraft(s.pretest, s.topicKey, "pretest") || !Array.isArray(s.comprehension)) throw invalid();
  if (s.comprehension.some((a, i) => !a || !Number.isInteger(a.value) || a.value < 1 || a.value > 4 ||
      a.correct !== (a.value === 2) || !Number.isSafeInteger(a.timestamp) ||
      (a.correct && i !== s.comprehension.length - 1))) throw invalid();
  if (s.phase !== "pretest" && !s.pretest.completedAt) throw invalid();
  if (["ready", "experiment", "posttest", "submitting", "complete"].includes(s.phase) && !s.comprehension.at(-1)?.correct) throw invalid();
  if (s.reading) {
    const r = s.reading;
    if (!Array.isArray(r.posts) || r.posts.length !== s.conditionN ||
        r.posts.some(p => !p || typeof p.id !== "string" || typeof p.content !== "string" || typeof p.displayName !== "string") ||
        new Set(r.posts.map(p => p.id)).size !== s.conditionN ||
        !Number.isSafeInteger(r.startTime) || r.deadline !== r.startTime + READING_DURATION_MS ||
        !Number.isSafeInteger(r.savedAt) || r.savedAt < r.startTime || r.savedAt > r.deadline ||
        !Array.isArray(r.actions) || r.actions.some(a => !a || !["like", "unlike", "share", "user_post"].includes(a.type)) ||
        !Array.isArray(r.scrollEvents) || !r.postVisibilitySummary || typeof r.postVisibilitySummary !== "object" || Array.isArray(r.postVisibilitySummary) ||
        !Number.isFinite(r.scrollY) || r.scrollY < 0 || !Number.isFinite(r.maxScrollY) || r.maxScrollY < 0 ||
        typeof r.userPostDraft !== "string" || (r.ownPost !== null && (!r.ownPost || typeof r.ownPost.content !== "string" || typeof r.ownPost.displayName !== "string"))) throw invalid();
  }
  if (s.phase === "experiment" && !s.reading) throw invalid();
  if (["posttest", "submitting", "complete"].includes(s.phase) &&
      (!s.endData || !validDraft(s.posttest, s.topicKey, "posttest") || s.endData.uid !== uid || s.endData.conditionN !== s.conditionN || s.endData.topicKey !== s.topicKey)) throw invalid();
  if (["submitting", "complete"].includes(s.phase) && !s.posttest?.completedAt) throw invalid();
  return s;
}

export function remainingReadingMs(reading: Pick<ReadingSnapshot, "deadline">, now = Date.now()): number {
  return Math.max(0, reading.deadline - now);
}

export function readingEndData(session: Pick<ExperimentSession, "uid" | "conditionN" | "topicKey">, reading: ReadingSnapshot, endTime: number, endReason: "manual" | "timeout", title: string): ReadingEndData {
  return { uid: session.uid, conditionN: session.conditionN, topic: title, topicKey: session.topicKey,
    startTime: reading.startTime, endTime: Math.min(endTime, reading.deadline), endReason,
    maxScrollY: reading.maxScrollY, postOrder: reading.posts.map(p => p.id), actions: reading.actions,
    scrollEvents: reading.scrollEvents, postVisibilitySummary: reading.postVisibilitySummary };
}

export function finalPayload(session: ExperimentSession): SubmitExperimentDataInput {
  if (!session.endData || !session.posttest?.completedAt || !session.pretest.completedAt) throw new Error("问卷尚未完成");
  return { ...session.endData, sessionId: session.sessionId, questionnaireVersion: session.questionnaireVersion,
    pretest: session.pretest, posttest: session.posttest, comprehension: session.comprehension };
}
