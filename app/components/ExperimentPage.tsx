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

import { randomAlphanumericDisplayName } from "../data/avatarPool";
import type { TopicKey } from "../data/topics";
import { blockRandomize } from "../lib/blockRandomize";
import type { ActionLog, EndReason, PostExperimentAttrs } from "../lib/dataSubmit";
import { enrichPostsForDisplay, type PostItemWithDisplay } from "../lib/enrichPosts";
import { getMaterialsForTopic } from "../lib/materialsRegistry";
import { useScrollTracker } from "../lib/scrollTracker";
import { CountdownBar, EXPERIMENT_DURATION_MS } from "./CountdownBar";
import type { ExperimentEndData } from "./EndPage";
import { PostCard } from "./PostCard";
import { ShareModal } from "./ShareModal";

const USER_POST_MAX_CHARS = 100;

export type ExperimentPageProps = {
  uid: string;
  conditionN: 8 | 16 | 48;
  topic: TopicKey;
  onEnd: (data: ExperimentEndData) => void;
};

export function ExperimentPage({
  uid,
  conditionN,
  topic,
  onEnd,
}: ExperimentPageProps) {
  const materialsFile = useMemo(() => getMaterialsForTopic(topic), [topic]);
  const { topic: topicTitle, topicDescription, tags } = materialsFile;

  const [isMounted, setIsMounted] = useState(false);
  const [posts, setPosts] = useState<PostItemWithDisplay[]>([]);
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const [shareCount, setShareCount] = useState(0);
  const [actions, setActions] = useState<ActionLog[]>([]);
  const actionsRef = useRef<ActionLog[]>([]);
  const postsRef = useRef<PostItemWithDisplay[]>([]);
  const [remainingMs, setRemainingMs] = useState(EXPERIMENT_DURATION_MS);
  const [isRunning, setIsRunning] = useState(true);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [currentSharePostId, setCurrentSharePostId] = useState<string | null>(
    null
  );
  const startTimeRef = useRef<number | null>(null);
  const endedRef = useRef(false);
  const [userPostDraft, setUserPostDraft] = useState("");
  const [userPostExpanded, setUserPostExpanded] = useState(false);
  const [ownPost, setOwnPost] = useState<{
    content: string;
    displayName: string;
  } | null>(null);

  const mainScrollRef = useRef<HTMLElement | null>(null);
  const composeBoxRef = useRef<HTMLDivElement | null>(null);
  const postElementsRef = useRef<Map<string, HTMLElement>>(new Map());

  const {
    bindScrollContainer,
    refreshObservers,
    registerPost,
    getScrollEvents,
    finalizeVisibility,
    getMaxScrollY,
    trackScroll,
    disconnect,
  } = useScrollTracker();

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    return () => {
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
    };
  }, []);

  useLayoutEffect(() => {
    const el = mainScrollRef.current;
    if (!el) return;
    bindScrollContainer(el);
    return () => bindScrollContainer(null);
  }, [bindScrollContainer]);

  useLayoutEffect(() => {
    if (!isMounted || posts.length === 0) return;
    refreshObservers();
  }, [isMounted, posts.length, refreshObservers]);

  useEffect(() => {
    const ordered = blockRandomize(materialsFile.materials, conditionN);
    setPosts(enrichPostsForDisplay(ordered, topic));
    startTimeRef.current = Date.now();
    setIsMounted(true);
  }, [conditionN, materialsFile, topic]);

  useLayoutEffect(() => {
    actionsRef.current = actions;
  }, [actions]);

  useLayoutEffect(() => {
    postsRef.current = posts;
  }, [posts]);

  const registerPostRef = useCallback(
    (postId: string) => (el: HTMLElement | null) => {
      if (el) {
        postElementsRef.current.set(postId, el);
      } else {
        postElementsRef.current.delete(postId);
      }
      registerPost(postId)(el);
    },
    [registerPost]
  );

  /**
   * 发布评论输入框是 sticky 的，发布后它的高度可能变化（多行输入框 -> 单行已发布文案），
   * 导致原本贴在顶部的帖子被"腰斩"。这里把滚动位置对齐到下一条完整可见的帖子，
   * 避免出现半截帖子卡在顶部的观感。纯即时对齐，不加平滑滚动动效。
   */
  const snapToFullPost = useCallback(() => {
    const container = mainScrollRef.current;
    const composeEl = composeBoxRef.current;
    if (!container || !composeEl) return;

    const contentTop = composeEl.getBoundingClientRect().bottom;

    for (const post of postsRef.current) {
      const el = postElementsRef.current.get(post.id);
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (rect.bottom <= contentTop) continue;
      if (rect.top < contentTop - 1) {
        container.scrollTop += contentTop - rect.top;
      }
      break;
    }
  }, []);

  useEffect(() => {
    if (ownPost == null) return;
    const id = requestAnimationFrame(() => snapToFullPost());
    return () => cancelAnimationFrame(id);
  }, [ownPost, snapToFullPost]);

  const getPostAttrs = useCallback((postId: string): PostExperimentAttrs => {
    const post = postsRef.current.find((p) => p.id === postId);
    if (!post) {
      throw new Error(`Post not found for action: ${postId}`);
    }
    return {
      stance: post.stance,
      sourceLevel: post.sourceLevel,
      quality: post.quality,
    };
  }, []);

  const finalize = useCallback(
    (endTime: number, endReason: EndReason) => {
      if (endedRef.current) return;
      endedRef.current = true;
      setIsRunning(false);

      const postOrder = posts.map((p) => p.id);
      trackScroll();
      const scrollEvents = getScrollEvents();
      const postVisibilitySummary = finalizeVisibility(postOrder, endTime);
      disconnect();

      onEnd({
        uid,
        conditionN,
        topic: topicTitle,
        topicKey: topic,
        startTime: startTimeRef.current ?? endTime,
        endTime,
        endReason,
        maxScrollY: getMaxScrollY(),
        postOrder,
        actions: actionsRef.current,
        scrollEvents,
        postVisibilitySummary,
      });
    },
    [
      conditionN,
      disconnect,
      finalizeVisibility,
      getMaxScrollY,
      getScrollEvents,
      onEnd,
      posts,
      topic,
      topicTitle,
      trackScroll,
      uid,
    ]
  );

  useEffect(() => {
    if (!isMounted || !isRunning) return;
    const id = window.setInterval(() => {
      setRemainingMs((prev) => {
        if (prev <= 1000) {
          window.clearInterval(id);
          return 0;
        }
        return prev - 1000;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [isMounted, isRunning]);

  useEffect(() => {
    if (!isMounted || !isRunning) return;
    if (remainingMs > 0) return;
    finalize(Date.now(), "timeout");
  }, [isMounted, remainingMs, isRunning, finalize]);

  useEffect(() => {
    if (!isRunning) {
      setIsShareModalOpen(false);
      setCurrentSharePostId(null);
    }
  }, [isRunning]);

  useEffect(() => () => disconnect(), [disconnect]);

  const closeShareModal = useCallback(() => {
    setIsShareModalOpen(false);
    setCurrentSharePostId(null);
  }, []);

  const appendAction = useCallback((log: ActionLog) => {
    const next = [...actionsRef.current, log];
    actionsRef.current = next;
    setActions(next);
  }, []);

  const handleLike = (e: MouseEvent<HTMLButtonElement>, postId: string) => {
    e.stopPropagation();
    if (!isMounted || !isRunning) return;
    const wasLiked = !!liked[postId];
    const ts = Date.now();
    setLiked((prev) => ({ ...prev, [postId]: !wasLiked }));
    appendAction({
      type: wasLiked ? "unlike" : "like",
      postId,
      timestamp: ts,
      ...getPostAttrs(postId),
    });
  };

  const handleShareClick = (e: MouseEvent<HTMLButtonElement>, postId: string) => {
    e.stopPropagation();
    if (!isMounted || !isRunning) return;
    if (shareCount >= 2) return;

    const prevActions = actionsRef.current;
    if (prevActions.some((a) => a.type === "share" && a.postId === postId)) {
      return;
    }
    const shareSoFar = prevActions.filter((a) => a.type === "share").length;
    if (shareSoFar >= 2) return;

    setCurrentSharePostId(postId);
    setIsShareModalOpen(true);
  };

  const handleShareModalCancel = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    closeShareModal();
  };

  const handleShareModalConfirm = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    const postId = currentSharePostId;
    if (postId == null || !isMounted || !isRunning) {
      closeShareModal();
      return;
    }
    if (shareCount >= 2) {
      closeShareModal();
      return;
    }

    const prevActions = actionsRef.current;
    if (prevActions.some((a) => a.type === "share" && a.postId === postId)) {
      closeShareModal();
      return;
    }
    const shareSoFar = prevActions.filter((a) => a.type === "share").length;
    if (shareSoFar >= 2) {
      closeShareModal();
      return;
    }

    const ts = Date.now();
    appendAction({
      type: "share",
      postId,
      timestamp: ts,
      order: shareSoFar + 1,
      ...getPostAttrs(postId),
    });
    setShareCount((c) => (c >= 2 ? c : c + 1));
    closeShareModal();
  };

  const onEndClick = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (!isMounted || shareCount < 2 || !isRunning) return;
    finalize(Date.now(), "manual");
  };

  const handleUserPostPublish = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (!isMounted || !isRunning || ownPost != null) return;
    const content = userPostDraft.trim();
    if (!content) return;
    appendAction({
      type: "user_post",
      content,
      timestamp: Date.now(),
      charCount: content.length,
    });
    setOwnPost({ content, displayName: randomAlphanumericDisplayName() });
    setUserPostExpanded(false);
  };

  const shareLocked = shareCount >= 2;

  return (
    <div className="fixed inset-0 mx-auto flex w-full max-w-[480px] flex-col overflow-hidden bg-white text-neutral-900 md:max-w-[640px]">
      <ShareModal
        open={isShareModalOpen && currentSharePostId != null}
        onCancel={handleShareModalCancel}
        onConfirm={handleShareModalConfirm}
      />

      <header className="sticky top-0 z-20 shrink-0 border-b border-neutral-200 bg-white/95 shadow-[0_1px_0_rgba(0,0,0,0.06)] backdrop-blur-sm">
        <div className="px-4 pb-3 pt-3">
          <h1 className="text-[18px] font-bold leading-snug text-neutral-900">
            {topicTitle}
          </h1>
          <p className="mt-2 text-[14px] leading-relaxed text-neutral-600">
            {topicDescription}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span
                key={tag}
                className="rounded bg-neutral-100 px-2 py-0.5 text-[12px] text-neutral-600"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </header>

      <main
        ref={mainScrollRef}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-24"
        aria-busy={!isMounted}
      >
        {isMounted ? (
          <div
            ref={composeBoxRef}
            className="sticky top-0 z-10 border-b border-neutral-100 bg-neutral-50 px-4 py-2.5"
          >
            {ownPost != null ? (
              <span className="inline-block rounded bg-green-100 px-2 py-0.5 text-[11px] font-medium text-green-700">
                已发布
              </span>
            ) : (
              <div className="flex items-end gap-2">
                <textarea
                  value={userPostDraft}
                  onChange={(e) =>
                    setUserPostDraft(e.target.value.slice(0, USER_POST_MAX_CHARS))
                  }
                  onFocus={() => setUserPostExpanded(true)}
                  onBlur={() => {
                    if (!userPostDraft.trim()) setUserPostExpanded(false);
                  }}
                  placeholder="你对这个议题有什么看法？欢迎分享你的观点..."
                  rows={userPostExpanded ? 3 : 1}
                  disabled={!isRunning}
                  className="min-w-0 flex-1 resize-none rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-[13px] leading-snug text-neutral-800 placeholder:text-neutral-400 focus:border-neutral-300 focus:outline-none disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={handleUserPostPublish}
                  disabled={!isRunning}
                  className="shrink-0 rounded-md bg-neutral-200 px-2.5 py-1.5 text-[12px] text-neutral-600 active:bg-neutral-300 disabled:opacity-50"
                >
                  发布
                </button>
              </div>
            )}
          </div>
        ) : null}

        <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-2.5 text-[13px] text-neutral-600">
          <span>默认</span>
          <span>全部内容 {isMounted ? posts.length : conditionN}</span>
        </div>

        {!isMounted ? (
          <div className="px-4 py-8">
            <p className="mb-6 text-center text-[14px] text-neutral-500">
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
            {ownPost != null ? (
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
                onShareClick={() => {}}
                onLikeClick={() => {}}
              />
            ) : null}
            {posts.map((post) => {
              const isLiked = !!liked[post.id];
              const hasSharedThisPost = actions.some(
                (a) => a.type === "share" && a.postId === post.id
              );
              const shareDisabled =
                !isRunning || shareLocked || hasSharedThisPost;
              return (
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
            })}
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
