"use client";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from "react";
import type { TopicKey } from "../data/topics";
import type { ActionLog, EndReason } from "../lib/dataSubmit";
import {
  ReadingTracker,
  READING_UI_VERSION,
  PANEL_READING_UI_VERSION,
  COVERAGE_RULE,
  type ReadingAlert,
} from "../lib/readingProtocol";
import {
  readingEndData,
  remainingReadingMs,
  type ReadingSnapshot,
  type ReadingEndData,
} from "../lib/experimentSession";
import { getMaterialsForTopic } from "../lib/materialsRegistry";
import { MasonryFeed } from "./MasonryFeed";
import { SpanningMasonryFeed } from "./SpanningMasonryFeed";
import { CompactPostCard } from "./CompactPostCard";
import { PostDetail } from "./PostDetail";
import { ReadingStatus } from "./ReadingStatus";
import { ShareModal } from "./ShareModal";
export type ExperimentPageProps = {
  uid: string;
  conditionN: 8 | 16 | 48;
  topic: TopicKey;
  initialReading: ReadingSnapshot;
  onSnapshot: (r: ReadingSnapshot) => void;
  onEnd: (r: ReadingEndData) => boolean;
};
export function ExperimentPage({
  uid,
  conditionN,
  topic,
  initialReading,
  onSnapshot,
  onEnd,
}: ExperimentPageProps) {
  const initial = useRef(initialReading).current,
    posts = initial.posts;
  const spanning = initial.metrics?.version === READING_UI_VERSION;
  const inline = initial.metrics?.version !== PANEL_READING_UI_VERSION;
  const alertFlashTarget = inline ? 5 : 2;
  const materials = useMemo(() => getMaterialsForTopic(topic), [topic]);
  const tracker = useMemo(
    () => new ReadingTracker(posts, initial),
    [posts, initial],
  );
  const [actions, setActions] = useState(initial.actions),
    actionsRef = useRef(initial.actions);
  const [remaining, setRemaining] = useState(() => remainingReadingMs(initial));
  const [opened, setOpened] = useState<string | null>(
      tracker.metrics.openDetailId,
    ),
    openedRef = useRef(tracker.metrics.openDetailId);
  const [expanded, setExpanded] = useState(
      initial.metrics?.openDetailIds ?? [],
    ),
    expandedRef = useRef(initial.metrics?.openDetailIds ?? []);
  const [sharePending, setSharePending] = useState<{
    id: string;
    surface: "preview" | "detail";
  } | null>(null);
  const [borderAlert, setBorderAlert] = useState(false);
  const ended = useRef(false),
    scroller = useRef<HTMLElement | null>(null),
    elements = useRef(new Map<string, HTMLElement>()),
    observer = useRef<IntersectionObserver | null>(null),
    detailObserver = useRef<IntersectionObserver | null>(null),
    anchor = useRef<{ id: string; offset: number } | null>(null),
    refs = useRef(new Map<string, (el: HTMLElement | null) => void>());
  const maxScroll = useRef(initial.maxScrollY),
    lastSave = useRef(0),
    stableAt = useRef(Date.now() + 150);
  const now = useCallback(
    () => Math.min(Date.now(), initial.deadline),
    [initial.deadline],
  );
  const scrollY = useCallback(
    () =>
      Math.max(0, Math.round(scroller.current?.scrollTop ?? initial.scrollY)),
    [initial.scrollY],
  );
  const capture = useCallback(() => {
    const time = now(),
      y = scrollY();
    maxScroll.current = Math.max(maxScroll.current, y);
    const snapshot = tracker.snapshot(time, y, actionsRef.current);
    return {
      ...initial,
      savedAt: time,
      actions: actionsRef.current,
      scrollY: y,
      maxScrollY: maxScroll.current,
      metrics: snapshot.metrics,
      scrollEvents: snapshot.events,
      postVisibilitySummary: snapshot.visibility,
    };
  }, [initial, now, scrollY, tracker]);
  const checkpoint = useCallback(() => {
    if (!ended.current) onSnapshot(capture());
  }, [capture, onSnapshot]);
  const observe = useCallback(() => {
    observer.current?.disconnect();
    detailObserver.current?.disconnect();
    if (
      !scroller.current ||
      (openedRef.current && !inline) ||
      document.visibilityState === "hidden" ||
      Date.now() >= initial.deadline
    )
      return;
    observer.current = new IntersectionObserver(
      (entries) => {
        if (
          (openedRef.current && !inline) ||
          document.visibilityState === "hidden" ||
          Date.now() < stableAt.current
        )
          return;
        const time = now(),
          y = scrollY();
        for (const e of entries) {
          const id = (e.target as HTMLElement).dataset.postId!;
          tracker.setVisible(
            id,
            !(
              inline &&
              (spanning
                ? expandedRef.current.includes(id)
                : id === openedRef.current)
            ) &&
              e.isIntersecting &&
              e.intersectionRatio >= COVERAGE_RULE.minimumRatio,
            time,
            y,
          );
        }
      },
      { root: scroller.current, threshold: [0, COVERAGE_RULE.minimumRatio] },
    );
    elements.current.forEach((el) => observer.current?.observe(el));
    const expandedIds = spanning
      ? expandedRef.current
      : openedRef.current
        ? [openedRef.current]
        : [];
    if (inline && expandedIds.length) {
      detailObserver.current = new IntersectionObserver(
        (entries) => {
          if (document.visibilityState === "hidden") return;
          for (const e of entries) {
            const id = (e.target.closest(".feed-card") as HTMLElement).dataset
              .postId!;
            if (
              !(spanning
                ? expandedRef.current.includes(id)
                : openedRef.current === id)
            )
              continue;
            if (e.isIntersecting && e.intersectionRect.height > 0)
              tracker.resumeDetail(now(), id);
            else tracker.stopDetail(now(), id);
          }
        },
        { root: scroller.current, threshold: 0 },
      );
      for (const id of expandedIds) {
        const text = elements.current.get(id)?.querySelector(".feed-fulltext");
        if (text) detailObserver.current.observe(text);
      }
    }
  }, [initial.deadline, inline, spanning, now, scrollY, tracker]);
  const register = useCallback((id: string) => {
    if (!refs.current.has(id))
      refs.current.set(id, (el) => {
        const old = elements.current.get(id);
        if (old) observer.current?.unobserve(old);
        if (el) {
          elements.current.set(id, el);
          observer.current?.observe(el);
        } else elements.current.delete(id);
      });
    return refs.current.get(id)!;
  }, []);
  const layoutReady = useRef(false);
  const measure = useCallback(() => {
    const root = scroller.current;
    if (!root || !layoutReady.current) return;
    const rect = root.getBoundingClientRect();
    for (const card of tracker.metrics.cards) {
      const el = elements.current.get(card.postId);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      const layout = {
        timestamp: now(),
        column: card.column,
        columns: tracker.metrics.columns,
        ...(spanning ? { columnSpan: card.columnSpan ?? 1 } : {}),
        left: Math.round(r.left - rect.left),
        top: Math.round(r.top - rect.top + root.scrollTop),
        width: Math.round(r.width),
        height: Math.round(r.height),
        viewportWidth: root.clientWidth,
        viewportHeight: root.clientHeight,
      };
      const last = card.layouts.at(-1);
      if (
        !last ||
        Object.entries(layout).some(
          ([k, v]) => k !== "timestamp" && last[k as keyof typeof last] !== v,
        )
      ) {
        // Keep initial and settled geometry without filling storage during window drags.
        if (
          card.layouts.length > 1 &&
          last &&
          layout.timestamp - last.timestamp < 500
        ) {
          card.layouts[card.layouts.length - 1] = layout;
        } else {
          card.layouts.push(layout);
          if (card.layouts.length > 128)
            card.layouts.splice(1, card.layouts.length - 128);
        }
      }
    }
  }, [now, spanning, tracker]);
  useLayoutEffect(() => {
    if (scroller.current) scroller.current.scrollTop = initial.scrollY;
    measure();
    const timer = setTimeout(observe, 170);
    const changed = () => {
      measure();
      observe();
    };
    const resize =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(changed);
    elements.current.forEach((el) => resize?.observe(el));
    if (scroller.current) resize?.observe(scroller.current);
    window.addEventListener("resize", changed);
    return () => {
      clearTimeout(timer);
      resize?.disconnect();
      window.removeEventListener("resize", changed);
      observer.current?.disconnect();
      detailObserver.current?.disconnect();
    };
  }, [initial.scrollY, measure, observe]);
  useEffect(() => {
    if (scroller.current) {
      if (opened && !inline) scroller.current.setAttribute("inert", "");
      else scroller.current.removeAttribute("inert");
    }
  }, [opened, inline]);
  const finalize = useCallback(
    (reason: EndReason) => {
      if (ended.current) return;
      // Even an already-expired restored session must settle its layout before
      // saving; the deadline remains unchanged and all actions stay disabled.
      if (!layoutReady.current) return;
      tracker.close(now());
      tracker.suspend(now(), scrollY());
      observer.current?.disconnect();
      detailObserver.current?.disconnect();
      const reading = capture();
      onSnapshot(reading);
      if (
        onEnd(
          readingEndData(
            { uid, conditionN, topicKey: topic },
            reading,
            reason === "timeout" ? initial.deadline : now(),
            reason,
            materials.topic,
          ),
        )
      )
        ended.current = true;
    },
    [
      capture,
      conditionN,
      initial.deadline,
      materials.topic,
      now,
      onEnd,
      onSnapshot,
      scrollY,
      topic,
      tracker,
      uid,
    ],
  );
  useEffect(() => {
    if (!inline && openedRef.current && document.visibilityState === "visible")
      tracker.resumeDetail(now());
    const alert = (kind: ReadingAlert["kind"], remainingMs: number) => {
      if (
        tracker.metrics.alerts.some((a) => a.kind === kind) ||
        document.visibilityState === "hidden"
      )
        return;
      tracker.metrics.alerts.push({
        kind,
        shownAt: now(),
        reason:
          initial.savedAt > initial.startTime && remainingMs < 30000
            ? "restored_below_threshold"
            : "threshold",
        flashes: 0,
        completedAt: null,
      });
      if (kind === "thirty_seconds") setBorderAlert(true);
    };
    const tick = () => {
      if (ended.current) return;
      const left = remainingReadingMs(initial);
      setRemaining(left);
      if (left <= 0) {
        finalize("timeout");
        return;
      }
      if (left <= 30000) alert("thirty_seconds", left);
      if (left <= 3000) alert("three_seconds", left);
      if (Date.now() - lastSave.current >= 1000) {
        lastSave.current = Date.now();
        checkpoint();
      }
    };
    const visibility = () => {
      if (document.visibilityState === "hidden") {
        tracker.suspend(now(), scrollY());
        observer.current?.disconnect();
        detailObserver.current?.disconnect();
        checkpoint();
      } else {
        if (openedRef.current && !inline) tracker.resumeDetail(now());
        else observe();
        tick();
      }
    };
    const pagehide = () => {
      tracker.suspend(now(), scrollY());
      checkpoint();
    };
    const onScroll = () => {
      maxScroll.current = Math.max(maxScroll.current, scrollY());
    };
    tick();
    const timer = setInterval(tick, 200);
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pagehide", pagehide);
    scroller.current?.addEventListener("scroll", onScroll, { passive: true });
    const el = scroller.current;
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("pagehide", pagehide);
      el?.removeEventListener("scroll", onScroll);
      tracker.suspend(now(), scrollY());
    };
  }, [checkpoint, finalize, initial, inline, now, observe, scrollY, tracker]);
  const canAct = () => {
    if (ended.current) return false;
    if (Date.now() >= initial.deadline) {
      finalize("timeout");
      return false;
    }
    return true;
  };
  const append = (action: ActionLog) => {
    actionsRef.current = [...actionsRef.current, action];
    setActions(actionsRef.current);
    checkpoint();
  };
  const attrs = (id: string) => {
    const p = posts.find((p) => p.id === id)!;
    return { stance: p.stance, sourceLevel: p.sourceLevel, quality: p.quality };
  };
  const like =
    (id: string, surface: "preview" | "detail") =>
    (e: MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      if (!canAct()) return;
      const last = actionsRef.current
        .filter(
          (a) => (a.type === "like" || a.type === "unlike") && a.postId === id,
        )
        .at(-1);
      append({
        type: last?.type === "like" ? "unlike" : "like",
        postId: id,
        timestamp: now(),
        ...attrs(id),
        interaction: tracker.context(id, surface),
      });
    };
  const share =
    (id: string, surface: "preview" | "detail") =>
    (e: MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      if (
        canAct() &&
        actionsRef.current.filter((a) => a.type === "share").length < 2 &&
        !actionsRef.current.some((a) => a.type === "share" && a.postId === id)
      )
        setSharePending({ id, surface });
    };
  const open = (id: string) => {
    if (!canAct()) return;
    const el = elements.current.get(id),
      root = scroller.current;
    if (inline && el && root)
      anchor.current = {
        id,
        offset: Math.max(
          0,
          el.getBoundingClientRect().top - root.getBoundingClientRect().top,
        ),
      };
    if (!spanning && openedRef.current) tracker.close(now());
    tracker.open(id, now(), scrollY(), inline);
    if (!inline) observer.current?.disconnect();
    if (spanning) {
      expandedRef.current = [...expandedRef.current, id];
      setExpanded(expandedRef.current);
    } else {
      openedRef.current = id;
      setOpened(id);
    }
    checkpoint();
    if (inline) requestAnimationFrame(observe);
  };
  const close = useCallback(
    (postId?: string) => {
      const id = postId ?? openedRef.current,
        root = scroller.current,
        el = id ? elements.current.get(id) : null;
      if (inline && id && root && el)
        anchor.current = {
          id,
          offset: Math.max(
            0,
            el.getBoundingClientRect().top - root.getBoundingClientRect().top,
          ),
        };
      tracker.close(now(), spanning ? (id ?? undefined) : undefined);
      if (spanning) {
        expandedRef.current = expandedRef.current.filter((v) => v !== id);
        setExpanded(expandedRef.current);
      } else {
        openedRef.current = null;
        setOpened(null);
      }
      checkpoint();
      requestAnimationFrame(observe);
    },
    [checkpoint, inline, spanning, now, observe, tracker],
  );
  useLayoutEffect(() => {
    if (spanning || !inline || !anchor.current || !scroller.current) return;
    const { id, offset } = anchor.current,
      el = elements.current.get(id),
      root = scroller.current;
    if (el)
      root.scrollTop +=
        el.getBoundingClientRect().top -
        root.getBoundingClientRect().top -
        offset;
    anchor.current = null;
    measure();
  }, [opened, inline, spanning, measure]);
  const liked = (id: string) =>
    actions
      .filter(
        (a) => (a.type === "like" || a.type === "unlike") && a.postId === id,
      )
      .at(-1)?.type === "like";
  const shared = (id: string) =>
      actions.some((a) => a.type === "share" && a.postId === id),
    shares = actions.filter((a) => a.type === "share").length;
  const own = initial.ownPost;
  const ownCard = own ? (
    <article className="feed-card own-card">
      <p className="feed-name">{own.displayName} · 我的发布</p>
      <p className="feed-preview">{own.content}</p>
      <span className="study-meta text-green-700">已发布</span>
    </article>
  ) : null;
  const Feed = spanning ? SpanningMasonryFeed : MasonryFeed;
  return (
    <div className="study-shell study-screen experiment-shell">
      <ReadingStatus
        remainingMs={remaining}
        shares={shares}
        title={materials.topic}
      />
      <div className="reading-stage">
        <main
          ref={scroller}
          className="study-scroll reading-feed"
          aria-label="实验内容"
          aria-hidden={!!opened && !inline}
        >
          <p className="reading-scenario study-meta">
            {materials.topicDescription}
          </p>
          <Feed
            initialLayout={
              initial.metrics?.cards[0]?.layouts.at(-1)
                ? {
                    columns: initial.metrics.columns,
                    viewportWidth:
                      initial.metrics.cards[0].layouts.at(-1)!.viewportWidth,
                    assignments: Object.fromEntries(
                      initial.metrics.cards.map((c) => [c.postId, c.column]),
                    ),
                  }
                : undefined
            }
            onLayout={(
              columns: number,
              assignments: Record<string, number>,
              spans?: Record<string, number>,
            ) => {
              tracker.metrics.columns = columns;
              for (const c of tracker.metrics.cards) {
                c.column = assignments[c.postId];
                if (spanning) c.columnSpan = spans?.[c.postId] ?? 1;
              }
              // Restore only after cards have moved into their measured columns.
              // Restoring against the temporary round-robin layout shifts the viewport.
              if (!layoutReady.current && scroller.current)
                scroller.current.scrollTop = initial.scrollY;
              layoutReady.current = true;
              if (spanning && anchor.current && scroller.current) {
                const el = elements.current.get(anchor.current.id),
                  root = scroller.current;
                if (el)
                  root.scrollTop +=
                    el.getBoundingClientRect().top -
                    root.getBoundingClientRect().top -
                    anchor.current.offset;
                anchor.current = null;
              }
              measure();
              if (spanning) requestAnimationFrame(observe);
            }}
            items={posts
              .flatMap((post, index) => {
                const item = {
                  id: post.id,
                  expanded: spanning ? expanded.includes(post.id) : false,
                  node: (
                    <CompactPostCard
                      post={post}
                      preview={tracker.metrics.cards[index].preview}
                      liked={liked(post.id)}
                      shared={shared(post.id)}
                      shareDisabled={shares >= 2 || shared(post.id)}
                      disabled={remaining <= 0}
                      rootRef={register(post.id)}
                      expanded={
                        inline &&
                        (spanning
                          ? expanded.includes(post.id)
                          : opened === post.id)
                      }
                      presentation={inline ? "inline" : "panel"}
                      onOpen={() => open(post.id)}
                      onCollapse={() => close(post.id)}
                      onLike={like(
                        post.id,
                        inline &&
                          (spanning
                            ? expanded.includes(post.id)
                            : opened === post.id)
                          ? "detail"
                          : "preview",
                      )}
                      onShare={share(
                        post.id,
                        inline &&
                          (spanning
                            ? expanded.includes(post.id)
                            : opened === post.id)
                          ? "detail"
                          : "preview",
                      )}
                    />
                  ),
                };
                return initial.insertBeforePostId === post.id && ownCard
                  ? [{ id: "own-post", expanded: false, node: ownCard }, item]
                  : [item];
              })
              .concat(
                initial.insertBeforePostId === null && ownCard
                  ? [{ id: "own-post", expanded: false, node: ownCard }]
                  : [],
              )}
          />
        </main>
        {opened && !inline ? (
          <PostDetail
            post={posts.find((p) => p.id === opened)!}
            liked={liked(opened)}
            shared={shared(opened)}
            disabled={remaining <= 0}
            shareDisabled={shares >= 2 || shared(opened)}
            onClose={close}
            onLike={like(opened, "detail")}
            onShare={share(opened, "detail")}
          />
        ) : null}
      </div>
      {shares === 2 ? (
        <footer className="reading-bottom">
          <button
            type="button"
            disabled={remaining <= 0}
            onClick={() => {
              if (canAct() && shares === 2) finalize("manual");
            }}
          >
            结束作答
          </button>
        </footer>
      ) : null}
      {borderAlert ? (
        <div
          className="reading-time-alert"
          aria-hidden
          style={{ animationIterationCount: alertFlashTarget }}
          onAnimationIteration={() => {
            const a = tracker.metrics.alerts.find(
              (a) => a.kind === "thirty_seconds",
            )!;
            a.flashes = Math.min(alertFlashTarget - 1, a.flashes + 1);
            checkpoint();
          }}
          onAnimationEnd={() => {
            const a = tracker.metrics.alerts.find(
              (a) => a.kind === "thirty_seconds",
            )!;
            a.flashes = alertFlashTarget;
            a.completedAt = now();
            setBorderAlert(false);
            checkpoint();
          }}
        />
      ) : null}
      <ShareModal
        open={!!sharePending}
        onCancel={() => setSharePending(null)}
        onConfirm={() => {
          if (sharePending && canAct()) {
            const { id, surface } = sharePending;
            const count = actionsRef.current.filter(
              (a) => a.type === "share",
            ).length;
            if (
              count < 2 &&
              !actionsRef.current.some(
                (a) => a.type === "share" && a.postId === id,
              )
            )
              append({
                type: "share",
                postId: id,
                timestamp: now(),
                order: count + 1,
                ...attrs(id),
                interaction: tracker.context(id, surface),
              });
          }
          setSharePending(null);
        }}
      />
    </div>
  );
}
