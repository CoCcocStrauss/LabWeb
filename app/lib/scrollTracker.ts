"use client";

import { useCallback, useEffect, useRef } from "react";
import type { PostVisibilitySummary, ScrollEvent } from "./dataSubmit";

export type TrackerSnapshot = { scrollEvents: ScrollEvent[]; postVisibilitySummary: PostVisibilitySummary; maxScrollY: number };
type VisibilityState = { totalVisibleMs: number; firstSeenAt: number | null; enterTime: number | null };

/** 保存累计曝光，不把刷新或切到后台期间算作阅读；截止时间不会因恢复而延长。 */
export function useScrollTracker(initial?: TrackerSnapshot, deadline = Infinity) {
  const events = useRef<ScrollEvent[]>(initial?.scrollEvents ?? []);
  const states = useRef(new Map<string, VisibilityState>(Object.entries(initial?.postVisibilitySummary ?? {}).map(([id, s]) => [id, { ...s, enterTime: null }])));
  const elements = useRef(new Map<string, HTMLElement>());
  const container = useRef<HTMLElement | null>(null);
  const observer = useRef<IntersectionObserver | null>(null);
  const maxScroll = useRef(initial?.maxScrollY ?? 0);
  const stableAt = useRef(Math.min(Date.now() + 800, deadline));
  const deadlineRef = useRef(deadline);
  const now = useCallback(() => Math.min(Date.now(), deadlineRef.current), []);
  const readScroll = useCallback(() => Math.max(0, Math.round(container.current?.scrollTop ?? window.scrollY ?? 0)), []);
  const trackScroll = useCallback(() => { maxScroll.current = Math.max(maxScroll.current, readScroll()); }, [readScroll]);
  const ensure = useCallback((id: string) => {
    let state = states.current.get(id);
    if (!state) { state = { totalVisibleMs: 0, firstSeenAt: null, enterTime: null }; states.current.set(id, state); }
    return state;
  }, []);
  const leave = useCallback((id: string, time: number) => {
    const state = ensure(id);
    if (state.enterTime === null) return;
    if (time > state.enterTime) {
      state.totalVisibleMs += time - state.enterTime;
      state.firstSeenAt ??= state.enterTime;
      events.current.push({ postId: id, action: "leave_viewport", timestamp: time, scrollY: readScroll() });
    }
    state.enterTime = null;
  }, [ensure, readScroll]);
  const closeVisible = useCallback(() => { const time = now(); states.current.forEach((_, id) => leave(id, time)); }, [leave, now]);

  const refreshObservers = useCallback(() => {
    observer.current?.disconnect();
    observer.current = null;
    if (document.visibilityState === "hidden" || Date.now() >= deadlineRef.current || !container.current) return;
    const root = container.current;
    observer.current = new IntersectionObserver(entries => {
      if (document.visibilityState === "hidden") return;
      const time = now();
      if (time < stableAt.current) return;
      for (const entry of entries) {
        const id = (entry.target as HTMLElement).dataset.trackedPostId;
        if (!id) continue;
        const state = ensure(id);
        if (entry.isIntersecting && entry.intersectionRatio >= 0.5 && time < deadlineRef.current) {
          if (state.enterTime === null) {
            state.enterTime = Math.max(time, stableAt.current);
            if (time >= stableAt.current) {
              state.firstSeenAt ??= time;
              events.current.push({ postId: id, action: "enter_viewport", timestamp: time, scrollY: readScroll() });
            }
          }
        } else { leave(id, time); }
      }
      trackScroll();
    }, { root, threshold: 0.5 });
    elements.current.forEach(el => observer.current?.observe(el));
  }, [ensure, leave, now, readScroll, trackScroll]);
  const bindScrollContainer = useCallback((el: HTMLElement | null) => { container.current = el; refreshObservers(); }, [refreshObservers]);
  const registerPost = useCallback((postId: string) => (el: HTMLElement | null) => {
    const old = elements.current.get(postId);
    if (old) observer.current?.unobserve(old);
    if (el) { el.dataset.trackedPostId = postId; elements.current.set(postId, el); ensure(postId); observer.current?.observe(el); }
    else { elements.current.delete(postId); }
  }, [ensure]);
  const finalizeVisibility = useCallback((ids: string[], endTime = now()): PostVisibilitySummary => {
    const time = Math.min(endTime, deadlineRef.current);
    return Object.fromEntries(ids.map(id => {
      const state = ensure(id);
      const elapsed = state.enterTime === null ? 0 : Math.max(0, time - state.enterTime);
      return [id, { totalVisibleMs: state.totalVisibleMs + elapsed, firstSeenAt: state.firstSeenAt ?? (elapsed > 0 ? state.enterTime : null) }];
    }));
  }, [ensure, now]);
  const getScrollEvents = useCallback(() => [...events.current], []);
  const getMaxScrollY = useCallback(() => maxScroll.current, []);
  const disconnect = useCallback(() => { observer.current?.disconnect(); observer.current = null; }, []);
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden") { closeVisible(); disconnect(); }
      else { refreshObservers(); }
    };
    const el = container.current;
    el?.addEventListener("scroll", trackScroll, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", closeVisible);
    // 首屏无需滚动，也能在布局稳定后产生 enter_viewport。
    const settle = window.setTimeout(refreshObservers, 810);
    return () => {
      clearTimeout(settle); el?.removeEventListener("scroll", trackScroll);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", closeVisible); disconnect();
    };
  }, [closeVisible, disconnect, refreshObservers, trackScroll]);
  return { bindScrollContainer, refreshObservers, registerPost, getScrollEvents, finalizeVisibility, getMaxScrollY, trackScroll, disconnect };
}
