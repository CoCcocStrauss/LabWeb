// Frozen v2 protocol: preserve existing sessions and scoring.
import { getReasons } from "../../../data/reasons";
import type { TopicKey } from "../../../data/topics";
import type { PostItem } from "../../../lib/blockRandomize";
import type { SubmitExperimentDataInput } from "./dataSubmit";
import { MAX_AUDIO_BYTES, audioExtension } from "../../../lib/audioConfig";
import { countEffectiveCharacters, recognitionExcerpt, RECOGNITION_VERSION } from "../../../lib/posttest";

const obj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const time = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v) && v > 0;
const nonnegative = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
const uuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
export const secretIsValid = (v: unknown): v is string => typeof v === "string" && /^[a-f0-9]{64}$/.test(v);

export function validAudioMetadata(value: unknown, sessionId?: string, allowExcluded = false): boolean {
  if (!obj(value) || !uuid(value.recordingId) || typeof value.mimeType !== "string" || value.mimeType.length > 200 || !audioExtension(value.mimeType) ||
      !nonnegative(value.durationMs) || !nonnegative(value.byteLength) || value.byteLength > MAX_AUDIO_BYTES ||
      !time(value.recordedAt) || (value.finishedAt !== null && (!time(value.finishedAt) || value.finishedAt < value.recordedAt))) return false;
  if (allowExcluded && value.state === "excluded") return value.storagePath === null;
  if (!time(value.finishedAt) || value.byteLength === 0 || !secretIsValid(value.sha256) || value.durationMs > value.finishedAt - value.recordedAt + 2000) return false;
  if (sessionId && value.state === "uploaded") return value.storagePath === `${sessionId}/${value.recordingId}.${audioExtension(value.mimeType)}`;
  return ["ready", "uploading", "uploaded"].includes(value.state as string);
}

export function validPostTasks(raw: unknown, posts: Map<string, PostItem>): boolean {
  const b = raw as SubmitExperimentDataInput;
  if (!Array.isArray(b.presentedPosts) || b.presentedPosts.length !== b.conditionN ||
      !Array.isArray(b.interruptions) || b.interruptions.length > 10000) return false;
  const presentation = new Map();
  for (let i = 0; i < b.presentedPosts.length; i++) {
    const item = b.presentedPosts[i];
    if (!obj(item) || item.postId !== b.postOrder[i] || typeof item.displayName !== "string" || !item.displayName || item.displayName.length > 80) return false;
    const post = posts.get(item.postId)!;
    if (post.sourceLevel === "high") {
      if (!post.sourceCandidates?.some(p => p.displayName === item.displayName && p.avatarFile === item.avatarFile) ||
          item.identityLabel !== (post.identityLabel ?? null) || item.platformLabel !== (post.platformLabel ?? null)) return false;
    } else if (item.avatarFile !== null || item.identityLabel !== null || item.platformLabel !== null) return false;
    presentation.set(item.postId, item);
  }
  const r = b.recognition;
  if (!obj(r) || r.version !== RECOGNITION_VERSION || r.type !== "content" || !Array.isArray(r.options) || !time(r.generatedAt) || r.generatedAt < b.endTime) return false;
  const shared = b.actions.filter(a => a.type === "share").map(a => a.postId);
  if (!shared.length) {
    if (r.status !== "not_applicable" || r.skipReason !== "no_shares" || r.options.length || r.targetPostId !== null || r.targetPresent !== false ||
        r.selected !== null || r.correct !== null || r.cannotRemember !== false || r.presentedAt !== null || r.answeredAt !== null || b.posttest.startedAt < r.generatedAt) return false;
  } else {
    if (r.status !== "answered" || r.skipReason !== null || r.targetPresent !== true || !shared.includes(r.targetPostId!) || r.options.length !== 4 ||
        new Set(r.options.map(o => o?.postId)).size !== 4 || !r.options.some(o => o?.postId === r.targetPostId) ||
        !time(r.presentedAt) || !time(r.answeredAt) || r.presentedAt < r.generatedAt || r.answeredAt < r.presentedAt || b.posttest.startedAt < r.answeredAt ||
        (r.selected !== "not_sure" && !r.options.some(o => o?.postId === r.selected)) || r.cannotRemember !== (r.selected === "not_sure") || r.correct !== (r.selected === r.targetPostId)) return false;
    for (const option of r.options) {
      if (!obj(option) || !presentation.has(option.postId) || (option.postId !== r.targetPostId && shared.includes(option.postId))) return false;
      const post = posts.get(option.postId)!; const author = presentation.get(option.postId)!;
      if (option.excerpt !== recognitionExcerpt(post.content) || option.displayName !== author.displayName || option.avatarFile !== author.avatarFile ||
          option.stance !== post.stance || option.sourceLevel !== post.sourceLevel || option.quality !== post.quality) return false;
    }
  }
  const e = b.explanation;
  if (!obj(e) || typeof e.text !== "string" || e.text.length > 10000 || e.effectiveCharCount !== countEffectiveCharacters(e.text) ||
      !time(e.startedAt) || !time(e.completedAt) || e.startedAt < b.posttest.answers[1].answeredAt || e.completedAt < e.startedAt) return false;
  let hasAudio = false;
  if (e.audio !== null) {
    if (!validAudioMetadata(e.audio, b.sessionId, true) || !["uploaded", "excluded"].includes(e.audio.state) || e.audio.recordedAt < e.startedAt || (e.audio.finishedAt !== null && e.audio.finishedAt > e.completedAt)) return false;
    hasAudio = e.audio.state === "uploaded";
  }
  if (e.effectiveCharCount < 20 && (!hasAudio || e.audio!.durationMs < 20000)) return false;
  if (e.inputMethod !== (hasAudio ? (e.text.trim() ? "both" : "audio") : "text")) return false;
  const reasons = b.reasons;
  const validIds = getReasons(b.topicKey as TopicKey).map(reason => reason.id);
  if (!obj(reasons) || !Array.isArray(reasons.order) || reasons.order.length !== validIds.length || new Set(reasons.order).size !== validIds.length ||
      !reasons.order.every(id => validIds.includes(id)) || reasons.order.at(-2) !== "other" || reasons.order.at(-1) !== "feeling" ||
      !Array.isArray(reasons.selected) || reasons.selected.length < 1 || reasons.selected.length > 3 || new Set(reasons.selected).size !== reasons.selected.length ||
      !reasons.selected.every(id => validIds.includes(id)) || (reasons.selected.includes("feeling") && reasons.selected.length !== 1) ||
      !reasons.selected.includes(reasons.primary!) || typeof reasons.otherText !== "string" || reasons.otherText.length > 500 ||
      !time(reasons.startedAt) || !time(reasons.selectedAt) || !time(reasons.completedAt) || reasons.startedAt < e.completedAt ||
      reasons.selectedAt < reasons.startedAt || reasons.completedAt < reasons.selectedAt || b.posttest.answers[2].startedAt < reasons.completedAt) return false;
  return b.interruptions.every(event => obj(event) && ["pretest", "pretest_save", "tutorial", "comprehension", "ready", "experiment", "recognition", "posttest", "explanation", "reasons", "post_museum"].includes(event.phase) && ["reload", "hidden", "visible"].includes(event.type) && time(event.timestamp) && event.timestamp >= b.pretest.startedAt && event.timestamp <= b.posttest.completedAt!);
}
