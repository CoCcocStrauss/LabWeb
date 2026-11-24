import { validPermission, validReadingProtocol } from "./readingValidation";
import {
  getQuestions,
  QUESTIONNAIRE_VERSION,
  type QuestionnaireResponse,
  type QuestionnaireStage,
} from "../data/questionnaire";
import { isTopicKey, type TopicKey } from "../../../data/topics";
import type {
  PretestInput,
  SubmitExperimentDataInput,
} from "../../../lib/dataSubmit";
import { READING_DURATION_MS } from "./experimentSession";
import { getMaterialsForTopic } from "../../../lib/materialsRegistry";
import { secretIsValid, validPostTasks } from "./posttestValidation";

const record = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v);
const integer = (v: unknown): v is number =>
  typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
const timestamp = (v: unknown): v is number => integer(v) && v > 0;
const uuid = (v: unknown) =>
  typeof v === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    v,
  );

export function validQuestionnaire(
  value: unknown,
  topic: TopicKey,
  stage: QuestionnaireStage,
  questionList = getQuestions,
): value is QuestionnaireResponse {
  if (
    !record(value) ||
    value.stage !== stage ||
    !timestamp(value.startedAt) ||
    !timestamp(value.completedAt) ||
    value.completedAt < value.startedAt ||
    !Array.isArray(value.answers)
  )
    return false;
  const questions = questionList(topic, stage);
  if (value.answers.length !== questions.length) return false;
  let previous = value.startedAt;
  for (let i = 0; i < questions.length; i++) {
    const a = value.answers[i];
    if (
      !record(a) ||
      a.questionId !== questions[i].id ||
      !integer(a.value) ||
      a.value < 1 ||
      a.value > questions[i].options.length ||
      !timestamp(a.startedAt) ||
      !timestamp(a.answeredAt) ||
      a.startedAt < previous ||
      a.answeredAt < a.startedAt ||
      a.answeredAt > value.completedAt
    )
      return false;
    previous = a.answeredAt;
  }
  return true;
}

export function validPretest(value: unknown): value is PretestInput {
  if (
    !record(value) ||
    typeof value.uid !== "string" ||
    !value.uid.trim() ||
    value.uid !== value.uid.trim() ||
    value.uid.length > 200 ||
    !uuid(value.sessionId) ||
    !secretIsValid(value.sessionSecret) ||
    ![8, 24, 48].includes(value.conditionN as number) ||
    typeof value.topicKey !== "string" ||
    !isTopicKey(value.topicKey) ||
    value.questionnaireVersion !== QUESTIONNAIRE_VERSION
  )
    return false;
  return (
    validPermission(value.microphonePermission) &&
    validQuestionnaire(value.pretest, value.topicKey, "pretest")
  );
}

export function validSubmission(
  value: unknown,
): value is SubmitExperimentDataInput {
  return validSubmissionWith(
    value,
    validPretest,
    validQuestionnaire,
    validPostTasks,
  );
}

/** Shared reading/behavior checks; questionnaire versions supply their own tasks. */
export function validSubmissionWith(
  value: unknown,
  pretestCheck: (value: unknown) => boolean,
  questionnaireCheck: typeof validQuestionnaire,
  postTasksCheck: typeof validPostTasks,
): value is SubmitExperimentDataInput {
  if (!pretestCheck(value) || !record(value)) return false;
  const b = value as PretestInput & Record<string, unknown>;
  if (
    !questionnaireCheck(b.posttest, b.topicKey, "posttest") ||
    !timestamp(b.startTime) ||
    !timestamp(b.endTime) ||
    b.endTime < b.startTime ||
    b.endTime - b.startTime > READING_DURATION_MS ||
    b.pretest.completedAt! > b.startTime ||
    b.posttest.startedAt < b.endTime ||
    !["manual", "timeout"].includes(b.endReason as string) ||
    (b.endReason === "timeout" &&
      b.endTime - b.startTime !== READING_DURATION_MS) ||
    !integer(b.maxScrollY) ||
    !Array.isArray(b.postOrder) ||
    b.postOrder.length !== b.conditionN ||
    new Set(b.postOrder).size !== b.conditionN ||
    !Array.isArray(b.actions) ||
    b.actions.length > 10000 ||
    !Array.isArray(b.scrollEvents) ||
    b.scrollEvents.length > 20000 ||
    !record(b.postVisibilitySummary) ||
    !Array.isArray(b.comprehension) ||
    b.comprehension.length !== 1
  )
    return false;
  const materials = getMaterialsForTopic(b.topicKey);
  if (b.topic !== materials.topic) return false;
  const posts = new Map(
    Object.values(materials.materials)
      .flat()
      .map((p) => [p.id, p]),
  );
  for (let offset = 0; offset < b.postOrder.length; offset += 8) {
    const cells = new Set();
    for (const id of b.postOrder.slice(offset, offset + 8)) {
      if (typeof id !== "string") return false;
      const post = posts.get(id);
      if (!post) return false;
      cells.add(`${post.stance}_${post.sourceLevel}_${post.quality}`);
    }
    if (cells.size !== 8) return false;
  }
  const ids = new Set(b.postOrder);
  let previous = b.pretest.completedAt!;
  const a = b.comprehension[0];
  if (
    !record(a) ||
    !integer(a.value) ||
    a.value < 1 ||
    a.value > 3 ||
    a.correct !== (a.value === 1) ||
    !timestamp(a.timestamp) ||
    a.timestamp < previous ||
    !timestamp(a.feedbackPresentedAt) ||
    a.feedbackPresentedAt < a.timestamp ||
    !integer(a.feedbackVisibleMs) ||
    a.feedbackVisibleMs !== (a.correct ? 3000 : 5000) ||
    !timestamp(a.autoAdvancedAt) ||
    a.autoAdvancedAt < a.feedbackPresentedAt + a.feedbackVisibleMs ||
    a.autoAdvancedAt > b.startTime
  )
    return false;
  previous = b.startTime;
  const shares = new Set<string>();
  let shareEvents = 0;
  let ownPosts = 0;
  for (const a of b.actions) {
    if (
      !record(a) ||
      !timestamp(a.timestamp) ||
      a.timestamp < previous ||
      a.timestamp > b.endTime
    )
      return false;
    previous = a.timestamp;
    if (a.type === "user_post") {
      ownPosts++;
      if (
        ownPosts > 1 ||
        typeof a.content !== "string" ||
        !a.content.trim() ||
        a.content.length > 100 ||
        a.charCount !== a.content.length
      )
        return false;
    } else {
      if (
        !["like", "unlike", "share", "unshare"].includes(a.type as string) ||
        typeof a.postId !== "string" ||
        !ids.has(a.postId)
      )
        return false;
      const p = posts.get(a.postId)!;
      if (
        a.stance !== p.stance ||
        a.sourceLevel !== p.sourceLevel ||
        a.quality !== p.quality
      )
        return false;
      if (a.type === "unshare") {
        if (!shares.has(a.postId)) return false;
        shares.delete(a.postId);
      }
      if (a.type === "share") {
        if (shares.has(a.postId) || a.order !== ++shareEvents) return false;
        shares.add(a.postId);
      }
    }
  }
  if (b.finalShareCount !== shares.size || b.metShareGoal !== shares.size >= 2)
    return false;
  if (
    b.unlockShownAtMs !== null &&
    (!timestamp(b.unlockShownAtMs) ||
      b.unlockShownAtMs < b.startTime + 100000 ||
      b.unlockShownAtMs > b.endTime)
  )
    return false;
  if (
    b.endReason === "manual" &&
    (shares.size < 2 ||
      b.endTime - b.startTime < 100000 ||
      b.unlockShownAtMs === null)
  )
    return false;
  previous = b.startTime;
  for (const e of b.scrollEvents) {
    if (
      !record(e) ||
      !ids.has(e.postId) ||
      !["enter_viewport", "leave_viewport"].includes(e.action as string) ||
      !timestamp(e.timestamp) ||
      e.timestamp < previous ||
      e.timestamp > b.endTime ||
      !integer(e.scrollY)
    )
      return false;
    previous = e.timestamp;
  }
  if (Object.keys(b.postVisibilitySummary).length !== ids.size) return false;
  for (const [id, entry] of Object.entries(b.postVisibilitySummary)) {
    if (
      !ids.has(id) ||
      !record(entry) ||
      !integer(entry.totalVisibleMs) ||
      entry.totalVisibleMs > b.endTime - b.startTime ||
      (entry.firstSeenAt !== null &&
        (!timestamp(entry.firstSeenAt) ||
          entry.firstSeenAt < b.startTime ||
          entry.firstSeenAt > b.endTime)) ||
      (entry.firstSeenAt === null && entry.totalVisibleMs !== 0)
    )
      return false;
  }
  return postTasksCheck(b, posts) && validReadingProtocol(b, posts);
}

/** 排序对象键，客户端重试只要数据相同就得到同一摘要。 */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (record(value))
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  return JSON.stringify(value);
}

export async function readRequestJson(request: Request): Promise<unknown> {
  if (Number(request.headers.get("content-length")) > 2_000_000)
    throw new Error("Payload too large");
  const text = await request.text();
  if (text.length > 2_000_000) throw new Error("Payload too large");
  return JSON.parse(text);
}
