import type { PostItemWithDisplay } from "./enrichPosts";
import type {
  ActionLog,
  PostVisibilitySummary,
  ScrollEvent,
} from "./dataSubmit";

export const READING_UI_VERSION = "responsive-masonry-preview-v1";
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
};
export type ReadingAlert = {
  kind: "thirty_seconds" | "three_seconds";
  shownAt: number;
  reason: "threshold" | "restored_below_threshold";
  flashes: number;
  completedAt: number | null;
};
export type ReadingMetrics = {
  version: typeof READING_UI_VERSION;
  coverageRule: typeof COVERAGE_RULE;
  columns: number;
  cards: CardPresentation[];
  viewedPostIds: string[];
  detailEvents: DetailEvent[];
  detailIntervals: DetailInterval[];
  openDetailId: string | null;
  alerts: ReadingAlert[];
  taskGoal: { requiredShares: 2; actualShares: number; achieved: boolean };
};
export function newReadingMetrics(
  posts: PostItemWithDisplay[],
): ReadingMetrics {
  return {
    version: READING_UI_VERSION,
    coverageRule: { ...COVERAGE_RULE },
    columns: 2,
    cards: posts.map((p, i) => ({
      postId: p.id,
      order: i + 1,
      column: (i % 2) as 0 | 1,
      preview: previewText(p.content),
      layouts: [],
    })),
    viewedPostIds: [],
    detailEvents: [],
    detailIntervals: [],
    openDetailId: null,
    alerts: [],
    taskGoal: { requiredShares: 2, actualShares: 0, achieved: false },
  };
}
export type RulesResponse = {
  startedAt: number;
  completedAt: number | null;
  items: { id: string; checked: boolean; changedAt: number | null }[];
};
export const RULES = [
  ["time", "正式阅读时间为90秒，点击“开始实验”后计时。"],
  ["shares", "在90秒内转发我最认同的两条内容，才算完成本次阅读任务。"],
  [
    "cards",
    "每张短卡显示正文开头，点击卡片可查看全文，再点内容可收起；短卡和全文都可以点赞、转发。",
  ],
  [
    "finish",
    "转发满两条后才显示“结束作答”按钮；我可以继续阅读，也可以点击它结束。",
  ],
  ["coverage", "顶部显示剩余时间和浏览进度；不需要浏览到100%。"],
  ["timeout", "时间到后阅读自动结束，并进入后续问题。"],
] as const;
export const newRules = (now = Date.now()): RulesResponse => ({
  startedAt: now,
  completedAt: null,
  items: RULES.map(([id]) => ({ id, checked: false, changedAt: null })),
});
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
  private detailStarted: number | null = null;
  constructor(
    posts: PostItemWithDisplay[],
    initial?: {
      metrics?: ReadingMetrics;
      scrollEvents: ScrollEvent[];
      postVisibilitySummary: PostVisibilitySummary;
    },
  ) {
    this.metrics = cloneMetrics(initial?.metrics ?? newReadingMetrics(posts));
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
  resumeDetail(time: number) {
    const id = this.metrics.openDetailId;
    if (id && this.detailStarted === null) {
      this.detailStarted = time;
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
  stopDetail(time: number) {
    if (this.detailStarted !== null && this.metrics.openDetailId)
      this.metrics.detailIntervals.push({
        postId: this.metrics.openDetailId,
        startedAt: this.detailStarted,
        endedAt: Math.max(time, this.detailStarted),
      });
    this.detailStarted = null;
  }
  open(id: string, time: number, scrollY: number) {
    this.suspend(time, scrollY);
    this.metrics.openDetailId = id;
    this.detailStarted = time;
    this.metrics.detailEvents.push({
      postId: id,
      type: "open",
      timestamp: time,
      visit: this.visits(id) + 1,
    });
  }
  close(time: number) {
    const id = this.metrics.openDetailId;
    if (!id) return;
    this.stopDetail(time);
    this.metrics.detailEvents.push({
      postId: id,
      type: "close",
      timestamp: time,
      visit: this.visits(id),
    });
    this.metrics.openDetailId = null;
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
    if (this.detailStarted !== null && metrics.openDetailId)
      metrics.detailIntervals.push({
        postId: metrics.openDetailId,
        startedAt: this.detailStarted,
        endedAt: Math.max(time, this.detailStarted),
      });
    const shares = actions.filter((a) => a.type === "share").length;
    metrics.taskGoal = {
      requiredShares: 2,
      actualShares: shares,
      achieved: shares === 2,
    };
    return {
      metrics,
      visibility,
      events: events.sort((a, b) => a.timestamp - b.timestamp),
    };
  }
}
