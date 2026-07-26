"use client";

import { useCallback, useEffect, useRef } from "react";

import type { PostVisibilitySummary, ScrollEvent } from "./dataSubmit";

type VisibilityState = {
  isVisible: boolean;
  enterTime: number | null;
  firstSeenAt: number | null;
  totalVisibleMs: number;
};

const DEFAULT_THRESHOLD = 0.5;
const INITIAL_LAYOUT_SETTLE_MS = 800;

export type UseScrollTrackerResult = {
  /** 绑定实际滚动容器（overflow-y-auto 的元素） */
  bindScrollContainer: (el: HTMLElement | null) => void;
  /** 帖子列表渲染完成后调用，重建 Observer 并刷新滚动根 */
  refreshObservers: () => void;
  /** 绑定到帖子根元素的 callback ref */
  registerPost: (postId: string) => (el: HTMLElement | null) => void;
  getScrollEvents: () => ScrollEvent[];
  finalizeVisibility: (
    postOrder: string[],
    endTime?: number
  ) => PostVisibilitySummary;
  getMaxScrollY: () => number;
  trackScroll: () => void;
  disconnect: () => void;
};

function readWindowScrollY(): number {
  if (typeof window === "undefined") return 0;
  return (
    window.scrollY ||
    document.documentElement.scrollTop ||
    document.body.scrollTop ||
    0
  );
}

/**
 * 用 Intersection Observer 追踪帖子可见性。
 * scrollY / maxScrollY 从实际滚动容器 scrollTop 读取；容器不可滚动时回退 window。
 */
export function useScrollTracker(
  threshold = DEFAULT_THRESHOLD
): UseScrollTrackerResult {
  const scrollEventsRef = useRef<ScrollEvent[]>([]);
  const visibilityRef = useRef<Map<string, VisibilityState>>(new Map());
  const observersRef = useRef<Map<string, IntersectionObserver>>(new Map());
  const elementsRef = useRef<Map<string, HTMLElement>>(new Map());
  const scrollContainerRef = useRef<HTMLElement | null>(null);
  const scrollListenerCleanupRef = useRef<(() => void) | null>(null);
  const maxScrollYRef = useRef(0);
  const stableStartTimeRef = useRef(Date.now() + INITIAL_LAYOUT_SETTLE_MS);

  const isContainerScrollable = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return false;
    return container.scrollHeight > container.clientHeight + 1;
  }, []);

  const getScrollRoot = useCallback((): Element | null => {
    return isContainerScrollable() ? scrollContainerRef.current : null;
  }, [isContainerScrollable]);

  const readScrollY = useCallback(
    (entry?: IntersectionObserverEntry, postEl?: HTMLElement | null) => {
      const container = scrollContainerRef.current;
      const containerScroll = container?.scrollTop ?? 0;
      const windowScroll = readWindowScrollY();

      if (isContainerScrollable()) {
        return containerScroll;
      }

      if (entry && postEl) {
        const rect = entry.boundingClientRect;
        const depth = Math.round(
          postEl.offsetTop - rect.top + windowScroll
        );
        return Math.max(windowScroll, depth, 0);
      }

      return Math.max(containerScroll, windowScroll);
    },
    [isContainerScrollable]
  );

  const updateMaxScrollY = useCallback(() => {
    maxScrollYRef.current = Math.max(maxScrollYRef.current, readScrollY());
  }, [readScrollY]);

  const handleIntersectionRef = useRef(
    (_postId: string, _entries: IntersectionObserverEntry[]) => {}
  );

  const appendEvent = useCallback(
    (
      postId: string,
      action: ScrollEvent["action"],
      entry?: IntersectionObserverEntry
    ) => {
      if (Date.now() < stableStartTimeRef.current) return;
      updateMaxScrollY();
      const postEl = elementsRef.current.get(postId) ?? null;
      scrollEventsRef.current.push({
        postId,
        action,
        timestamp: Date.now(),
        scrollY: readScrollY(entry, postEl),
      });
    },
    [readScrollY, updateMaxScrollY]
  );

  const ensureState = useCallback((postId: string): VisibilityState => {
    let state = visibilityRef.current.get(postId);
    if (!state) {
      state = {
        isVisible: false,
        enterTime: null,
        firstSeenAt: null,
        totalVisibleMs: 0,
      };
      visibilityRef.current.set(postId, state);
    }
    return state;
  }, []);

  const handleIntersection = useCallback(
    (postId: string, entries: IntersectionObserverEntry[]) => {
      const entry = entries[0];
      if (!entry) return;

      const state = ensureState(postId);
      const now = Date.now();
      const stableStartTime = stableStartTimeRef.current;
      const isNowVisible =
        entry.isIntersecting && entry.intersectionRatio >= threshold;

      if (isNowVisible && !state.isVisible) {
        state.isVisible = true;
        state.enterTime = Math.max(now, stableStartTime);
        if (state.firstSeenAt === null && now >= stableStartTime) {
          state.firstSeenAt = now;
        }
        appendEvent(postId, "enter_viewport", entry);
      } else if (!isNowVisible && state.isVisible) {
        if (state.enterTime !== null) {
          const effectiveEnterTime = Math.max(state.enterTime, stableStartTime);
          if (now > effectiveEnterTime) {
            state.totalVisibleMs += now - effectiveEnterTime;
            if (state.firstSeenAt === null) {
              state.firstSeenAt = effectiveEnterTime;
            }
          }
        }
        state.isVisible = false;
        state.enterTime = null;
        appendEvent(postId, "leave_viewport", entry);
      }
    },
    [appendEvent, ensureState, threshold]
  );

  handleIntersectionRef.current = handleIntersection;

  const createObserver = useCallback(
    (postId: string, el: HTMLElement) => {
      const observer = new IntersectionObserver(
        (entries) => handleIntersectionRef.current(postId, entries),
        { root: getScrollRoot(), threshold }
      );
      observer.observe(el);
      observersRef.current.set(postId, observer);
    },
    [getScrollRoot, threshold]
  );

  const reconnectObservers = useCallback(() => {
    for (const observer of Array.from(observersRef.current.values())) {
      observer.disconnect();
    }
    observersRef.current.clear();

    for (const [postId, el] of Array.from(elementsRef.current.entries())) {
      createObserver(postId, el);
    }
  }, [createObserver]);

  const attachScrollListeners = useCallback(() => {
    scrollListenerCleanupRef.current?.();
    scrollListenerCleanupRef.current = null;

    const cleanups: Array<() => void> = [];
    const onScroll = () => updateMaxScrollY();

    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener("scroll", onScroll, { passive: true });
      cleanups.push(() =>
        container.removeEventListener("scroll", onScroll)
      );
    }

    if (typeof window !== "undefined") {
      window.addEventListener("scroll", onScroll, { passive: true });
      cleanups.push(() => window.removeEventListener("scroll", onScroll));
    }

    updateMaxScrollY();
    scrollListenerCleanupRef.current = () => {
      for (const cleanup of cleanups) cleanup();
    };
  }, [updateMaxScrollY]);

  const bindScrollContainer = useCallback(
    (el: HTMLElement | null) => {
      if (el) {
        scrollContainerRef.current = el;
        attachScrollListeners();
        if (elementsRef.current.size > 0) {
          reconnectObservers();
        }
        return;
      }

      scrollListenerCleanupRef.current?.();
      scrollListenerCleanupRef.current = null;
    },
    [attachScrollListeners, reconnectObservers]
  );

  const refreshObservers = useCallback(() => {
    attachScrollListeners();
    reconnectObservers();
    updateMaxScrollY();
  }, [attachScrollListeners, reconnectObservers, updateMaxScrollY]);

  const registerPost = useCallback(
    (postId: string) => (el: HTMLElement | null) => {
      const existingObserver = observersRef.current.get(postId);
      if (existingObserver) {
        existingObserver.disconnect();
        observersRef.current.delete(postId);
      }

      if (!el) {
        elementsRef.current.delete(postId);
        return;
      }

      elementsRef.current.set(postId, el);
      ensureState(postId);
      createObserver(postId, el);
    },
    [createObserver, ensureState]
  );

  const getScrollEvents = useCallback(() => [...scrollEventsRef.current], []);

  const finalizeVisibility = useCallback(
    (postOrder: string[], endTime = Date.now()) => {
      const summary: PostVisibilitySummary = {};

      for (const postId of postOrder) {
        const state = visibilityRef.current.get(postId);
        if (!state || state.firstSeenAt === null) {
          if (
            state?.isVisible &&
            state.enterTime !== null &&
            endTime > stableStartTimeRef.current
          ) {
            const effectiveEnterTime = Math.max(
              state.enterTime,
              stableStartTimeRef.current
            );
            summary[postId] = {
              totalVisibleMs: Math.max(0, endTime - effectiveEnterTime),
              firstSeenAt: effectiveEnterTime,
            };
          } else {
            summary[postId] = { totalVisibleMs: 0, firstSeenAt: null };
          }
          continue;
        }
        let totalVisibleMs = state.totalVisibleMs;
        if (state.isVisible && state.enterTime !== null) {
          const effectiveEnterTime = Math.max(
            state.enterTime,
            stableStartTimeRef.current
          );
          if (endTime > effectiveEnterTime) {
            totalVisibleMs += endTime - effectiveEnterTime;
          }
        }
        summary[postId] = {
          totalVisibleMs,
          firstSeenAt: state.firstSeenAt,
        };
      }

      return summary;
    },
    []
  );

  const getMaxScrollY = useCallback(() => maxScrollYRef.current, []);

  const disconnect = useCallback(() => {
    scrollListenerCleanupRef.current?.();
    scrollListenerCleanupRef.current = null;
    for (const observer of Array.from(observersRef.current.values())) {
      observer.disconnect();
    }
    observersRef.current.clear();
    elementsRef.current.clear();
  }, []);

  useEffect(() => () => disconnect(), [disconnect]);

  return {
    bindScrollContainer,
    refreshObservers,
    registerPost,
    getScrollEvents,
    finalizeVisibility,
    getMaxScrollY,
    trackScroll: updateMaxScrollY,
    disconnect,
  };
}
