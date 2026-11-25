import { activeShares } from "./blinded";
import {
  LABEL_SELECTION_VERSION,
  chooseDisplayedLabel,
  type DisplayedLabelSelection,
} from "../../../lib/labelSelection";
import { TUTORIAL_POSTS } from "../data/tutorial";
import type { PostItemWithDisplay } from "../../../lib/enrichPosts";
import type {
  ActionLog,
  PostVisibilitySummary,
  ScrollEvent,
} from "../../../lib/dataSubmit";

export const PANEL_READING_UI_VERSION = "responsive-masonry-preview-v1";
export const SINGLE_INLINE_READING_UI_VERSION = "inline-masonry-preview-v1";
export const READING_UI_VERSION = "spanning-inline-masonry-v1";
export const PREVIEW_VERSION = "opening-before-punctuation-20-v1";
export const COVERAGE_RULE = { minimumRatio: 0.5, continuousMs: 250 } as const;
const cloneMetrics = (value: ReadingMetrics): ReadingMetrics =>
  JSON.parse(JSON.stringify(value));
export type Preview = {
  text: string;
  lengthTruncated: boolean;
  ruleVersion: typeof PREVIEW_VERSION;
};
export function previewText(content: string): Preview {
  const first = content
    .trimStart()
    .split(/[。？！；：?!;:.\r\n]/u, 1)[0]
    .trimEnd();
  // A visible grapheme (including emoji clusters) counts as one character.
  const chars =
    typeof Intl.Segmenter === "function"
      ? [
          ...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(
            first,
          ),
        ].map((v) => v.segment)
      : Array.from(first);
  const lengthTruncated = chars.length > 20;
  return {
    text: chars.slice(0, 20).join("").trimEnd() + (lengthTruncated ? "…" : ""),
    lengthTruncated,
    ruleVersion: PREVIEW_VERSION,
  };
}
export function assignMasonryColumns(
  heights: number[],
  columns: number,
  gap = 10,
): number[] {
  const totals = Array.from({ length: columns }, () => 0);
  return heights.map((height) => {
    const column = totals.indexOf(Math.min(...totals));
    totals[column] += height + gap;
    return column;
  });
}

export type CardLayout = {
  column: number;
  columns: number;
  columnSpan?: number;
  timestamp: number;
  left: number;
  top: number;
  width: number;
  height: number;
  viewportWidth: number;
  viewportHeight: number;
};
export type CardPresentation = {
  postId: string;
  order: number;
  column: number;
  columnSpan?: number;
  preview: Preview;
  layouts: CardLayout[];
};
export type DetailEvent = {
  postId: string;
  type: "open" | "close" | "resume";
  timestamp: number;
  visit: number;
};
export type DetailInterval = {
  postId: string;
  startedAt: number;
  endedAt: number;
  /** Unix milliseconds; aliases retain compatibility with existing exports. */
  startMs?: number;
  endMs?: number;
  durationMs?: number;
};
export const DETAIL_VISIBILITY_VERSION = "inline-visible-segments-v1";
export const ATTENTION_VERSION = "reading-visibility-v1";
function detailInterval(postId: string, startedAt: number, endedAt: number) {
  return {
    postId,
    startedAt,
    endedAt,
    startMs: startedAt,
    endMs: endedAt,
    durationMs: endedAt - startedAt,
  };
}
export type ReadingAlert = {
  kind: "thirty_seconds" | "three_seconds";
  shownAt: number;
  reason: "threshold" | "restored_below_threshold";
  flashes: number;
  completedAt: number | null;
};
export type ReadingMetrics = {
  attentionVersion?: typeof ATTENTION_VERSION;
  hiddenCount?: number;
  totalHiddenMs?: number;
  hiddenAtMs?: number | null;
  detailVisibilityVersion?: typeof DETAIL_VISIBILITY_VERSION;
  unlockShownAtMs?: number | null;
  packingVersion?: "free-rect-top-first-v1";
  labelSelectionVersion?: typeof LABEL_SELECTION_VERSION;
  version:
    | typeof READING_UI_VERSION
    | typeof PANEL_READING_UI_VERSION
    | typeof SINGLE_INLINE_READING_UI_VERSION;
  coverageRule: typeof COVERAGE_RULE;
  columns: number;
  cards: CardPresentation[];
  viewedPostIds: string[];
  detailEvents: DetailEvent[];
  detailIntervals: DetailInterval[];
  openDetailId: string | null;
  openDetailIds?: string[];
  alerts: ReadingAlert[];
  taskGoal: { requiredShares: 2; actualShares: number; achieved: boolean };
};
export function newReadingMetrics(
  posts: PostItemWithDisplay[],
): ReadingMetrics {
  return {
    attentionVersion: ATTENTION_VERSION,
    hiddenCount: 0,
    totalHiddenMs: 0,
    hiddenAtMs: null,
    detailVisibilityVersion: DETAIL_VISIBILITY_VERSION,
    version: READING_UI_VERSION,
    packingVersion: "free-rect-top-first-v1",
    labelSelectionVersion: LABEL_SELECTION_VERSION,
    coverageRule: { ...COVERAGE_RULE },
    columns: 2,
    cards: posts.map((p, i) => ({
      postId: p.id,
      order: i + 1,
      column: (i % 2) as 0 | 1,
      columnSpan: 1,
      preview: previewText(p.content),
      layouts: [],
    })),
    viewedPostIds: [],
    detailEvents: [],
    detailIntervals: [],
    openDetailId: null,
    openDetailIds: [],
    alerts: [],
    taskGoal: { requiredShares: 2, actualShares: 0, achieved: false },
  };
}
export type RulesResponse = {
  presentationVersion?: typeof TUTORIAL_VERSION;
  activeStep?: TutorialStepId;
  demoLabelSelectionVersion?: typeof LABEL_SELECTION_VERSION;
  demoLabelSelections?: Record<string, DisplayedLabelSelection>;
  startedAt: number;
  completedAt: number | null;
  items: {
    id: string;
    checked: boolean;
    changedAt: number | null;
    enteredAt?: number | null;
    completedAt?: number | null;
    demoPostId?: string | null;
  }[];
};
export const TUTORIAL_VERSION = "three-step-demo-v1";
export const TUTORIAL_STEPS = [
  {
    id: "step_1",
    title: "如何阅读",
    text: "点击卡片可展开全文，再点一次收起。不需要看完所有帖子，按自己的节奏浏览即可。",
  },
  {
    id: "step_2",
    title: "如何转发与改选",
    text: "请至少转发 2 条最认同的内容（可多选，期间可随时取消或更改）。点赞不计入转发数。",
  },
  {
    id: "step_3",
    title: "时间、专注与激励",
    text: "完成阅读和转发后可点击底部按钮结束，时间到自动进入后续问题。",
  },
] as const;
export type TutorialStepId = (typeof TUTORIAL_STEPS)[number]["id"];
// Kept for already-completed sessions using the former checkbox tutorial.
export const RULES = [
  ["cards", "我会认真阅读帖子，点击卡片可展开全文，再次点击可收起。"],
  [
    "shares",
    "我需要至少转发 2 条最认同的内容（可多选，期间可随时取消或更改），才算完成本次阅读任务。",
  ],
  ["coverage", "顶部会显示剩余时间和已转发数量，不需要看完所有帖子。"],
  [
    "finish",
    "完成阅读和转发后可点击底部按钮结束；时间到后会自动进入后续问题。",
  ],
] as const;
export const newRules = (
  now = Date.now(),
  existingDemoLabels?: Record<string, DisplayedLabelSelection>,
): RulesResponse => ({
  presentationVersion: TUTORIAL_VERSION,
  activeStep: "step_1",
  startedAt: now,
  completedAt: null,
  demoLabelSelectionVersion: LABEL_SELECTION_VERSION,
  demoLabelSelections:
    existingDemoLabels ??
    Object.fromEntries(
      TUTORIAL_POSTS.map((p) => [p.id, chooseDisplayedLabel(p)]),
    ),
  items: TUTORIAL_STEPS.map(({ id }, i) => ({
    id,
    checked: false,
    changedAt: null,
    enteredAt: i === 0 ? now : null,
    completedAt: null,
    demoPostId: i < 2 ? String(TUTORIAL_POSTS[0].id) : null,
  })),
});
export function enterTutorialStep(
  response: RulesResponse,
  id: TutorialStepId,
  now = Date.now(),
): RulesResponse {
  return {
    ...response,
    activeStep: id,
    items: response.items.map((item) =>
      item.id === id ? { ...item, enteredAt: item.enteredAt ?? now } : item,
    ),
  };
}
export function completeTutorialStep(
  response: RulesResponse,
  id: TutorialStepId,
  now = Date.now(),
): RulesResponse {
  return {
    ...response,
    items: response.items.map((item) =>
      item.id === id
        ? {
            ...item,
            checked: true,
            changedAt: item.completedAt ?? now,
            enteredAt: item.enteredAt ?? now,
            completedAt: item.completedAt ?? now,
          }
        : item,
    ),
  };
}
export type MicrophonePermission = {
  state:
    | "not_checked"
    | "checking"
    | "granted"
    | "denied"
    | "unavailable"
    | "error";
  requestedAt: number | null;
  completedAt: number | null;
};
export const newPermission = (): MicrophonePermission => ({
  state: "not_checked",
  requestedAt: null,
  completedAt: null,
});
export type InteractionContext = {
  surface: "preview" | "detail";
  detailOpenedBefore: boolean;
};

/** Pure tracker: snapshots close active intervals virtually; restored sessions never count the reload gap. */
export class ReadingTracker {
  metrics: ReadingMetrics;
  events: ScrollEvent[];
  states = new Map<
    string,
    { totalVisibleMs: number; firstSeenAt: number | null; enter: number | null }
  >();
  private detailStarts = new Map<string, number>();
  private hiddenStart: number | null = null;
  constructor(
    posts: PostItemWithDisplay[],
    initial?: {
      metrics?: ReadingMetrics;
      scrollEvents: ScrollEvent[];
      postVisibilitySummary: PostVisibilitySummary;
      savedAt?: number;
    },
  ) {
    this.metrics = cloneMetrics(initial?.metrics ?? newReadingMetrics(posts));
    this.metrics.attentionVersion = ATTENTION_VERSION;
    this.metrics.hiddenCount ??= 0;
    this.metrics.totalHiddenMs ??= 0;
    this.metrics.hiddenAtMs ??= null;
    if (this.metrics.hiddenAtMs !== null)
      this.hiddenStart = initial?.savedAt ?? this.metrics.hiddenAtMs;
    this.metrics.detailVisibilityVersion = DETAIL_VISIBILITY_VERSION;
    this.metrics.detailIntervals = this.metrics.detailIntervals.map((i) =>
      detailInterval(i.postId, i.startedAt, i.endedAt),
    );
    this.events = [...(initial?.scrollEvents ?? [])];
    for (const p of posts)
      this.states.set(p.id, {
        ...(initial?.postVisibilitySummary[p.id] ?? {
          totalVisibleMs: 0,
          firstSeenAt: null,
        }),
        enter: null,
      });
  }
  setVisible(id: string, visible: boolean, time: number, scrollY: number) {
    const s = this.states.get(id);
    if (!s) return;
    // An observer callback queued before expansion must not restart preview time.
    if (this.isOpen(id) || this.hiddenStart !== null) visible = false;
    if (visible && s.enter === null) {
      s.enter = time;
      s.firstSeenAt ??= time;
      this.events.push({
        postId: id,
        action: "enter_viewport",
        timestamp: time,
        scrollY,
      });
    }
    if (!visible && s.enter !== null) {
      this.qualify(id, time);
      s.totalVisibleMs += Math.max(0, time - s.enter);
      s.enter = null;
      this.events.push({
        postId: id,
        action: "leave_viewport",
        timestamp: time,
        scrollY,
      });
    }
  }
  qualify(id: string, time: number) {
    const s = this.states.get(id)!;
    if (
      s.enter !== null &&
      time - s.enter >= COVERAGE_RULE.continuousMs &&
      !this.metrics.viewedPostIds.includes(id)
    )
      this.metrics.viewedPostIds.push(id);
  }
  suspend(time: number, scrollY: number) {
    for (const id of this.states.keys())
      this.setVisible(id, false, time, scrollY);
    this.stopDetail(time);
  }
  hide(time: number, scrollY: number) {
    if (this.hiddenStart === null) {
      this.hiddenStart = time;
      this.metrics.hiddenAtMs = time;
      this.metrics.hiddenCount = (this.metrics.hiddenCount ?? 0) + 1;
    }
    this.suspend(time, scrollY);
  }
  show(time: number) {
    if (this.hiddenStart === null) return false;
    this.metrics.totalHiddenMs =
      (this.metrics.totalHiddenMs ?? 0) + Math.max(0, time - this.hiddenStart);
    this.hiddenStart = null;
    this.metrics.hiddenAtMs = null;
    return true;
  }
  resumeDetail(
    time: number,
    id = this.metrics.openDetailId ?? this.metrics.openDetailIds?.[0],
  ) {
    if (id && this.hiddenStart === null && this.isOpen(id) && !this.detailStarts.has(id)) {
      this.detailStarts.set(id, time);
      this.metrics.detailEvents.push({
        postId: id,
        type: "resume",
        timestamp: time,
        visit: this.visits(id),
      });
    }
  }
  visits(id: string) {
    return this.metrics.detailEvents.filter(
      (e) => e.postId === id && e.type === "open",
    ).length;
  }
  private isOpen(id: string) {
    return (
      this.metrics.openDetailId === id ||
      this.metrics.openDetailIds?.includes(id) === true
    );
  }
  stopDetail(time: number, id?: string) {
    for (const [postId, startedAt] of this.detailStarts) {
      if (id && postId !== id) continue;
      if (time > startedAt)
        this.metrics.detailIntervals.push(detailInterval(postId, startedAt, time));
      this.detailStarts.delete(postId);
    }
  }
  open(id: string, time: number, scrollY: number, inline = false) {
    const multiple = inline && this.metrics.version === READING_UI_VERSION;
    if (multiple && this.metrics.openDetailIds?.includes(id)) return;
    if (inline) this.setVisible(id, false, time, scrollY);
    else this.suspend(time, scrollY);
    if (multiple)
      this.metrics.openDetailIds = [...(this.metrics.openDetailIds ?? []), id];
    else this.metrics.openDetailId = id;
    if (!inline) this.detailStarts.set(id, time);
    this.metrics.detailEvents.push({
      postId: id,
      type: "open",
      timestamp: time,
      visit: this.visits(id) + 1,
    });
  }
  close(time: number, id?: string) {
    const ids = id
      ? [id]
      : [
          ...(this.metrics.openDetailIds ?? []),
          ...(this.metrics.openDetailId ? [this.metrics.openDetailId] : []),
        ];
    for (const postId of ids) {
      if (
        this.metrics.openDetailId !== postId &&
        !this.metrics.openDetailIds?.includes(postId)
      )
        continue;
      this.stopDetail(time, postId);
      this.metrics.detailEvents.push({
        postId,
        type: "close",
        timestamp: time,
        visit: this.visits(postId),
      });
      if (this.metrics.openDetailId === postId)
        this.metrics.openDetailId = null;
      if (this.metrics.openDetailIds)
        this.metrics.openDetailIds = this.metrics.openDetailIds.filter(
          (v) => v !== postId,
        );
    }
  }
  context(id: string, surface: "preview" | "detail"): InteractionContext {
    return { surface, detailOpenedBefore: this.visits(id) > 0 };
  }
  snapshot(time: number, scrollY: number, actions: ActionLog[]) {
    const visibility: PostVisibilitySummary = {};
    const events = [...this.events];
    for (const [id, s] of this.states) {
      this.qualify(id, time);
      visibility[id] = {
        totalVisibleMs:
          s.totalVisibleMs +
          (s.enter === null ? 0 : Math.max(0, time - s.enter)),
        firstSeenAt: s.firstSeenAt,
      };
      if (s.enter !== null)
        events.push({
          postId: id,
          action: "leave_viewport",
          timestamp: time,
          scrollY,
        });
    }
    const metrics = cloneMetrics(this.metrics);
    if (this.hiddenStart !== null)
      metrics.totalHiddenMs =
        (metrics.totalHiddenMs ?? 0) + Math.max(0, time - this.hiddenStart);
    for (const [postId, startedAt] of this.detailStarts)
      if (time > startedAt)
        metrics.detailIntervals.push(detailInterval(postId, startedAt, time));
    const shares = activeShares(actions).length;
    metrics.taskGoal = {
      requiredShares: 2,
      actualShares: shares,
      achieved: shares >= 2,
    };
    return {
      metrics,
      visibility,
      events: events.sort((a, b) => a.timestamp - b.timestamp),
    };
  }
}
