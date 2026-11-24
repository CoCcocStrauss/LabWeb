import type { DisplayedLabelSelection } from "./labelSelection";
import type { TopicKey } from "../data/topics";
import { getReasons } from "../data/reasons";
import { shuffleArray } from "./blockRandomize";
import type { ActionLog } from "./dataSubmit";
import type { PostItemWithDisplay } from "./enrichPosts";

export const RECOGNITION_VERSION = "content-4-plus-memory-v1";
export type RecognitionOption = {
  postId: string; excerpt: string; displayName: string; avatarFile: string | null;
  stance: string; sourceLevel: string; quality: string;
};
export type RecognitionResponse = {
  version: typeof RECOGNITION_VERSION; type: "content"; status: "pending" | "answered" | "not_applicable";
  options: RecognitionOption[]; targetPostId: string | null; targetPresent: boolean;
  selected: string | null; correct: boolean | null; cannotRemember: boolean;
  generatedAt: number; presentedAt: number | null; answeredAt: number | null; skipReason: "no_shares" | "insufficient_distractors" | null;
};
export type AudioMetadata = {
  recordingId: string; mimeType: string; durationMs: number; byteLength: number; sha256: string | null;
  state: "recording" | "interrupted" | "ready" | "uploading" | "uploaded" | "excluded";
  storagePath: string | null; recordedAt: number; finishedAt: number | null;
};
export type ExplanationResponse = {
  startedAt: number; completedAt: number | null; text: string; effectiveCharCount: number;
  inputMethod: "text" | "audio" | "both" | null; audio: AudioMetadata | null;
};
export type ReasonsResponse = {
  order: string[]; selected: string[]; primary: string | null; otherText: string;
  startedAt: number; selectedAt: number | null; completedAt: number | null;
};
export type Interruption = { phase: string; type: "reload" | "hidden" | "visible"; timestamp: number };
export type PresentedPost = Partial<DisplayedLabelSelection> & { postId: string; displayName: string; avatarFile: string | null; identityLabel: string | null; platformLabel: string | null };

export const recognitionExcerpt = (content: string) => [...content].slice(0, 48).join("");
export function createRecognition(posts: PostItemWithDisplay[], actions: ActionLog[], now = Date.now()): RecognitionResponse {
  const shared = actions.filter(a => a.type === "share").map(a => a.postId);
  const base: RecognitionResponse = { version: RECOGNITION_VERSION, type: "content", status: "not_applicable",
    options: [], targetPostId: null, targetPresent: false, selected: null, correct: null, cannotRemember: false,
    generatedAt: now, presentedAt: null, answeredAt: null, skipReason: "no_shares" };
  if (!shared.length) return base;
  const targetId = shared[Math.floor(Math.random() * shared.length)];
  const target = posts.find(p => p.id === targetId);
  if (!target) throw new Error("再认目标材料缺失");
  const excerpts = new Set([recognitionExcerpt(target.content)]);
  const distractors = shuffleArray(posts.filter(p => !shared.includes(p.id))).filter(p => {
    const text = recognitionExcerpt(p.content);
    if (excerpts.has(text)) return false;
    excerpts.add(text); return true;
  }).slice(0, 3);
  if (distractors.length !== 3) throw new Error("再认候选材料不足");
  const options = shuffleArray([target, ...distractors]).map(p => ({ postId: p.id, excerpt: recognitionExcerpt(p.content),
    displayName: p.displayName, avatarFile: p.avatarFile ?? null, stance: p.stance, sourceLevel: p.sourceLevel, quality: p.quality }));
  return { ...base, status: "pending", options, targetPostId: target.id, targetPresent: true, skipReason: null };
}
export function answerRecognition(response: RecognitionResponse, selected: string, now = Date.now()): RecognitionResponse {
  return { ...response, status: "answered", selected, correct: selected === response.targetPostId,
    cannotRemember: selected === "not_sure", answeredAt: now };
}
export const countEffectiveCharacters = (text: string) => (text.match(/[\p{L}\p{N}]/gu) ?? []).length;
export const explanationQualifies = (e: ExplanationResponse) => countEffectiveCharacters(e.text) >= 20 ||
  (!!e.audio && ["ready", "uploaded"].includes(e.audio.state) && e.audio.durationMs >= 20_000);
export function newExplanation(now = Date.now()): ExplanationResponse {
  return { startedAt: now, completedAt: null, text: "", effectiveCharCount: 0, inputMethod: null, audio: null };
}
export function newReasons(topic: TopicKey, now = Date.now()): ReasonsResponse {
  const options = getReasons(topic);
  return { order: [...shuffleArray(options.slice(0, -2).map(r => r.id)), "other", "feeling"], selected: [], primary: null,
    otherText: "", startedAt: now, selectedAt: null, completedAt: null };
}
export function toggleReason(selected: string[], id: string): string[] {
  if (selected.includes(id)) return selected.filter(r => r !== id);
  if (id === "feeling") return [id];
  const next = selected.filter(r => r !== "feeling");
  return next.length < 3 ? [...next, id] : selected;
}
