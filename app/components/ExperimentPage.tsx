"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { randomLowSourceNickname } from "../data/avatarPool";
import type { TopicKey } from "../data/topics";
import type { ActionLog, EndReason, PostExperimentAttrs } from "../lib/dataSubmit";
import type { PostItemWithDisplay } from "../lib/enrichPosts";
import { readingEndData, remainingReadingMs, type ReadingSnapshot, type ReadingEndData } from "../lib/experimentSession";
import { getMaterialsForTopic } from "../lib/materialsRegistry";
import { useScrollTracker } from "../lib/scrollTracker";
import { CountdownBar } from "./CountdownBar";
import { PostCard } from "./PostCard";
import { ShareModal } from "./ShareModal";

const USER_POST_MAX_CHARS = 100;
export type ExperimentPageProps = {
  uid: string; conditionN: 8 | 16 | 48; topic: TopicKey;
  initialReading: ReadingSnapshot;
  onSnapshot: (reading: ReadingSnapshot) => void;
  onEnd: (data: ReadingEndData) => boolean;
};

export function ExperimentPage({ uid, conditionN, topic, initialReading, onSnapshot, onEnd }: ExperimentPageProps) {
  const initial = useRef(initialReading).current;
  const materialsFile = useMemo(() => getMaterialsForTopic(topic), [topic]);
  const { topic: topicTitle, topicDescription, tags } = materialsFile;
  const posts: PostItemWithDisplay[] = initial.posts;
  const isMounted = true;
  const [actions, setActions] = useState<ActionLog[]>(initial.actions);
  const actionsRef = useRef(initial.actions);
  const liked = Object.fromEntries(actions.filter(a => a.type === "like" || a.type === "unlike").map(a => [a.postId, a.type === "like"]));
  const shareCount = actions.filter(a => a.type === "share").length;
  const [remainingMs, setRemainingMs] = useState(() => remainingReadingMs(initial));
  const [isRunning, setIsRunning] = useState(true);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [currentSharePostId, setCurrentSharePostId] = useState<string | null>(null);
  const endedRef = useRef(false);
  const [userPostDraft, setUserPostDraft] = useState(initial.userPostDraft);
  const [ownPost, setOwnPost] = useState(initial.ownPost);
  const [insertBeforePostId, setInsertBeforePostId] = useState(initial.insertBeforePostId);
  const composeState = useRef({ userPostDraft: initial.userPostDraft, ownPost: initial.ownPost, insertBeforePostId: initial.insertBeforePostId });
  const mainScrollRef = useRef<HTMLElement | null>(null);
  const composeBoxRef = useRef<HTMLDivElement | null>(null);
  const composeInputRef = useRef<HTMLTextAreaElement | null>(null);
  const postElementsRef = useRef<Map<string, HTMLElement>>(new Map());
  const ownPostRef = useRef<HTMLElement | null>(null);
  const { bindScrollContainer, refreshObservers, registerPost, getScrollEvents, finalizeVisibility, getMaxScrollY, trackScroll, disconnect } = useScrollTracker(initial, initial.deadline);

  useEffect(() => {
    const html = document.documentElement; const body = document.body;
    const previous = [html.style.overflow, body.style.overflow];
    html.style.overflow = "hidden"; body.style.overflow = "hidden";
    return () => { html.style.overflow = previous[0]; body.style.overflow = previous[1]; };
  }, []);
  useLayoutEffect(() => {
    const el = mainScrollRef.current;
    bindScrollContainer(el);
    if (el) el.scrollTop = initial.scrollY;
    refreshObservers();
    return () => bindScrollContainer(null);
  }, [bindScrollContainer, initial.scrollY, refreshObservers]);

  useLayoutEffect(() => {
    const input = composeInputRef.current;
    if (!input) return;
    const resize = () => {
      input.style.height = "auto";
      input.style.height = `${Math.max(48, input.scrollHeight + 2)}px`;
    };
    resize();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", resize);
      return () => window.removeEventListener("resize", resize);
    }
    let previousWidth = input.clientWidth;
    const observer = new ResizeObserver(() => {
      if (input.clientWidth === previousWidth) return;
      previousWidth = input.clientWidth;
      resize();
    });
    observer.observe(input);
    return () => observer.disconnect();
  }, [userPostDraft, ownPost]);

  const registeredRefs = useRef(new Map<string, (el: HTMLElement | null) => void>());
  const registerPostRef = useCallback((postId: string) => {
    let ref = registeredRefs.current.get(postId);
    if (!ref) {
      const track = registerPost(postId);
      ref = el => { if (el) postElementsRef.current.set(postId, el); else postElementsRef.current.delete(postId); track(el); };
      registeredRefs.current.set(postId, ref);
    }
    return ref;
  }, [registerPost]);

  const capture = useCallback((time = Math.min(Date.now(), initial.deadline)): ReadingSnapshot => {
    trackScroll();
    return { ...initial, ...composeState.current, savedAt: time, actions: actionsRef.current,
      scrollY: mainScrollRef.current?.scrollTop ?? initial.scrollY, maxScrollY: getMaxScrollY(),
      scrollEvents: getScrollEvents(), postVisibilitySummary: finalizeVisibility(posts.map(p => p.id), time) };
  }, [finalizeVisibility, getMaxScrollY, getScrollEvents, initial, posts, trackScroll]);
  const checkpoint = useCallback(() => { if (!endedRef.current) onSnapshot(capture()); }, [capture, onSnapshot]);
  const finalize = useCallback((endTime: number, endReason: EndReason) => {
    if (endedRef.current) return;
    const reading = capture(Math.min(endTime, initial.deadline));
    onSnapshot(reading);
    const saved = onEnd(readingEndData({ uid, conditionN, topicKey: topic }, reading, endTime, endReason, topicTitle));
    if (saved) { endedRef.current = true; setIsRunning(false); disconnect(); }
  }, [capture, conditionN, disconnect, initial, onEnd, onSnapshot, topic, topicTitle, uid]);

  useEffect(() => {
    const tick = () => {
      if (endedRef.current) return;
      const remaining = remainingReadingMs(initial);
      setRemainingMs(remaining);
      if (remaining <= 0) finalize(initial.deadline, "timeout");
      else checkpoint();
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    const onVisible = () => { if (document.visibilityState === "visible") tick(); else checkpoint(); };
    const onPageShow = () => tick();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pagehide", checkpoint);
    window.addEventListener("pageshow", onPageShow);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pagehide", checkpoint); window.removeEventListener("pageshow", onPageShow); };
  }, [checkpoint, finalize, initial]);

  const ownPostJustPublished = useRef(false);
  useEffect(() => {
    if (!ownPost || !ownPostJustPublished.current) return;
    ownPostJustPublished.current = false;
    const id = requestAnimationFrame(() => {
      const el = ownPostRef.current; const container = mainScrollRef.current; const compose = composeBoxRef.current;
      if (!el || !container || !compose) return;
      container.scrollTop += el.getBoundingClientRect().top - container.getBoundingClientRect().top - compose.offsetHeight;
      checkpoint();
    });
    return () => cancelAnimationFrame(id);
  }, [checkpoint, ownPost]);

  const canAct = () => {
    if (!isRunning || endedRef.current) return false;
    if (Date.now() >= initial.deadline) { finalize(initial.deadline, "timeout"); return false; }
    return true;
  };
  const getPostAttrs = (postId: string): PostExperimentAttrs => {
    const post = posts.find(p => p.id === postId)!;
    return { stance: post.stance, sourceLevel: post.sourceLevel, quality: post.quality };
  };
  const appendAction = (log: ActionLog) => {
    const next = [...actionsRef.current, log]; actionsRef.current = next; setActions(next); checkpoint();
  };
  const handleLike = (e: MouseEvent<HTMLButtonElement>, postId: string) => {
    e.stopPropagation(); if (!canAct()) return;
    const last = actionsRef.current.filter(a => (a.type === "like" || a.type === "unlike") && a.postId === postId).at(-1);
    appendAction({ type: last?.type === "like" ? "unlike" : "like", postId, timestamp: Date.now(), ...getPostAttrs(postId) });
  };
  const closeShareModal = () => { setIsShareModalOpen(false); setCurrentSharePostId(null); };
  const handleShareClick = (e: MouseEvent<HTMLButtonElement>, postId: string) => {
    e.stopPropagation(); if (!canAct()) return;
    const shares = actionsRef.current.filter(a => a.type === "share");
    if (shares.length >= 2 || shares.some(a => a.postId === postId)) return;
    setCurrentSharePostId(postId); setIsShareModalOpen(true);
  };
  const handleShareModalCancel = (e: MouseEvent<HTMLButtonElement>) => { e.stopPropagation(); closeShareModal(); };
  const handleShareModalConfirm = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    const postId = currentSharePostId;
    if (!postId || !canAct()) { closeShareModal(); return; }
    const shares = actionsRef.current.filter(a => a.type === "share");
    if (shares.length < 2 && !shares.some(a => a.postId === postId)) {
      appendAction({ type: "share", postId, timestamp: Date.now(), order: shares.length + 1, ...getPostAttrs(postId) });
    }
    closeShareModal();
  };
  const onEndClick = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation(); if (canAct() && actionsRef.current.filter(a => a.type === "share").length >= 2) finalize(Date.now(), "manual");
  };
  const handleUserPostPublish = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation(); if (!canAct() || composeState.current.ownPost) return;
    const content = composeState.current.userPostDraft.trim(); if (!content) return;
    let insertBefore: string | null = null;
    const bottom = composeBoxRef.current?.getBoundingClientRect().bottom ?? 0;
    for (const post of posts) {
      const el = postElementsRef.current.get(post.id);
      if (el && el.getBoundingClientRect().bottom > bottom) { insertBefore = post.id; break; }
    }
    const own = { content, displayName: randomLowSourceNickname() };
    composeState.current = { userPostDraft: "", ownPost: own, insertBeforePostId: insertBefore };
    ownPostJustPublished.current = true;
    setInsertBeforePostId(insertBefore); setOwnPost(own); setUserPostDraft("");
    appendAction({ type: "user_post", content, timestamp: Date.now(), charCount: content.length });
  };
  const shareLocked = shareCount >= 2;

  return (
    <div className="study-shell study-screen">
      <ShareModal
        open={isShareModalOpen && currentSharePostId != null}
        onCancel={handleShareModalCancel}
        onConfirm={handleShareModalConfirm}
      />

      <header className="reading-header study-header study-pad z-20 border-b border-neutral-200 bg-white">
        <h1 className="study-title">{topicTitle}</h1>
      </header>

      <main
        ref={mainScrollRef}
        className="study-scroll pb-6"
        aria-busy={!isMounted}
      >
        <div className="study-pad py-4">
          <p className="study-copy text-neutral-600">
            {topicDescription}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span
                key={tag}
                className="study-meta rounded bg-neutral-100 px-2 py-1 text-neutral-600"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
        {isMounted ? (
          <div
            ref={composeBoxRef}
            className="study-pad sticky top-0 z-10 border-b border-neutral-100 bg-neutral-50 py-3"
          >
            {ownPost != null ? (
              <span className="study-meta inline-block rounded bg-green-100 px-2 py-1 font-medium text-green-700">
                已发布
              </span>
            ) : (
              <div className="flex items-end gap-2">
                <textarea
                  ref={composeInputRef}
                  value={userPostDraft}
                  onChange={(e) => {
                    const value = e.target.value.slice(0, USER_POST_MAX_CHARS);
                    composeState.current.userPostDraft = value;
                    setUserPostDraft(value);
                    checkpoint();
                  }}
                  placeholder="分享你的看法…"
                  aria-label="分享你的看法"
                  maxLength={USER_POST_MAX_CHARS}
                  rows={1}
                  disabled={!isRunning}
                  className="study-composer-input study-control min-w-0 flex-1 resize-none rounded-lg border border-neutral-200 bg-white px-3 py-3 text-neutral-800 placeholder:text-neutral-500 focus:border-blue-400 disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={handleUserPostPublish}
                  disabled={!isRunning || !userPostDraft.trim()}
                  className="study-control shrink-0 whitespace-nowrap rounded-lg bg-neutral-200 px-3 py-3 text-neutral-700 active:bg-neutral-300 disabled:opacity-50"
                >
                  发布
                </button>
              </div>
            )}
          </div>
        ) : null}

        <div className="study-pad study-meta flex items-center justify-between gap-3 border-b border-neutral-100 py-3 text-neutral-600">
          <span>默认</span>
          <span>全部内容 {isMounted ? posts.length : conditionN}</span>
        </div>

        {!isMounted ? (
          <div className="study-pad py-8">
            <p className="study-copy mb-6 text-center text-neutral-500">
              加载中…
            </p>
            <div className="space-y-6">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex gap-3 animate-pulse">
                  <div className="h-11 w-11 shrink-0 rounded-full bg-neutral-200" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="h-4 w-28 rounded bg-neutral-200" />
                    <div className="space-y-2">
                      <div className="h-3 w-full rounded bg-neutral-100" />
                      <div className="h-3 w-full rounded bg-neutral-100" />
                      <div className="h-3 w-4/5 rounded bg-neutral-100" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="divide-y divide-neutral-100">
            {posts.flatMap((post) => {
              const isLiked = !!liked[post.id];
              const hasSharedThisPost = actions.some(
                (a) => a.type === "share" && a.postId === post.id
              );
              const shareDisabled =
                !isRunning || shareLocked || hasSharedThisPost;
              const regularCard = (
                <PostCard
                  key={post.id}
                  post={post}
                  isLiked={isLiked}
                  hasShared={hasSharedThisPost}
                  shareDisabled={shareDisabled}
                  interactionsDisabled={!isRunning}
                  rootRef={registerPostRef(post.id)}
                  onShareClick={(e) => handleShareClick(e, post.id)}
                  onLikeClick={(e) => handleLike(e, post.id)}
                />
              );
              // 若此帖子是发布后的插入点，在它前面渲染自己的帖子
              if (ownPost != null && post.id === insertBeforePostId) {
                return [
                  <PostCard
                    key="own-post"
                    post={{
                      id: "own-post",
                      content: ownPost.content,
                      sourceLevel: "low",
                      displayName: ownPost.displayName,
                    }}
                    isLiked={false}
                    hasShared={false}
                    shareDisabled
                    interactionsDisabled
                    rootRef={(el) => {
                      ownPostRef.current = el;
                    }}
                    onShareClick={() => {}}
                    onLikeClick={() => {}}
                  />,
                  regularCard,
                ];
              }
              return [regularCard];
            })}
            {/* 用户在列表末尾发布（insertBeforePostId === null）时追加到最后 */}
            {ownPost != null && insertBeforePostId === null ? (
              <PostCard
                post={{
                  id: "own-post",
                  content: ownPost.content,
                  sourceLevel: "low",
                  displayName: ownPost.displayName,
                }}
                isLiked={false}
                hasShared={false}
                shareDisabled
                interactionsDisabled
                rootRef={(el) => {
                  ownPostRef.current = el;
                }}
                onShareClick={() => {}}
                onLikeClick={() => {}}
              />
            ) : null}
          </div>
        )}
      </main>

      <CountdownBar
        remainingMs={remainingMs}
        shareCount={shareCount}
        isMounted={isMounted}
        isRunning={isRunning}
        onEndClick={onEndClick}
      />
    </div>
  );
}
