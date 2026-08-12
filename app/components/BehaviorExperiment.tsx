"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent,
} from "react";

import {
  HIGH_SOURCE_AVATAR_MAP,
  HIGH_SOURCE_NAMES,
  randomLowSourceNickname,
} from "../data/avatarPool";
import {
  EXPERIMENT_MATERIALS,
  type PostItem,
} from "../data/experimentMaterials";
import { IDENTITY_LABEL_PAIRS } from "../data/identityPool";
import { CountdownBar, EXPERIMENT_DURATION_MS } from "./CountdownBar";
import { PostCard } from "./PostCard";
import { ShareModal } from "./ShareModal";

export type { PostItem };

type PostItemWithAvatar = PostItem & {
  displayName: string;
  avatarFile?: string;
  identityLabel?: string | null;
  platformLabel?: string | null;
};

type LikeLog = { action: "like"; postId: number; timestamp: number };
type ShareLog = {
  action: "share";
  postId: number;
  timestamp: number;
  order: number;
};
type ActionLog = LikeLog | ShareLog;

/** 仅打乱展示顺序；每条帖子的 id 与正文等属性不变。 */
function shuffleDisplayOrder(items: readonly PostItem[]): PostItem[] {
  const copy = structuredClone(items) as PostItem[];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

/** 为每条帖子分配展示名、头像与身份描述（会话内固定）；低信源为随机字母数字名。 */
function enrichPostsForDisplay(posts: PostItem[]): PostItemWithAvatar[] {
  return posts.map((p) => {
    if (p.sourceLevel === "high") {
      const displayName =
        HIGH_SOURCE_NAMES[
          Math.floor(Math.random() * HIGH_SOURCE_NAMES.length)
        ]!;
      const avatarFile = HIGH_SOURCE_AVATAR_MAP[displayName];
      const labelPair =
        IDENTITY_LABEL_PAIRS[
          Math.floor(Math.random() * IDENTITY_LABEL_PAIRS.length)
        ]!;
      return {
        ...p,
        displayName,
        avatarFile,
        identityLabel: labelPair.identityLabel,
        platformLabel: labelPair.platformLabel,
      };
    }
    return {
      ...p,
      displayName: randomLowSourceNickname(),
    };
  });
}

type BehaviorLogRow = {
  startTime: string;
  endTime: string;
  totalDuration: number;
  actionType: string;
  postId: number | "";
  timestamp: string;
  order: number | "";
};

function buildFlatBehaviorRows(
  startTime: number,
  endTime: number,
  logs: ActionLog[]
): BehaviorLogRow[] {
  const totalDuration = Math.max(0, Math.round((endTime - startTime) / 1000));
  const startIso = new Date(startTime).toISOString();
  const endIso = new Date(endTime).toISOString();

  if (logs.length === 0) {
    return [
      {
        startTime: startIso,
        endTime: endIso,
        totalDuration,
        actionType: "",
        postId: "",
        timestamp: "",
        order: "",
      },
    ];
  }

  return logs.map((log) => {
    if (log.action === "like") {
      return {
        startTime: startIso,
        endTime: endIso,
        totalDuration,
        actionType: "like",
        postId: log.postId,
        timestamp: new Date(log.timestamp).toISOString(),
        order: "",
      };
    }
    return {
      startTime: startIso,
      endTime: endIso,
      totalDuration,
      actionType: "share",
      postId: log.postId,
      timestamp: new Date(log.timestamp).toISOString(),
      order: log.order,
    };
  });
}

/** 仅在浏览器内动态加载 xlsx，避免服务端打包/预渲染时执行导致 Server Error */
async function exportToExcel(
  posts: PostItem[],
  startTime: number,
  endTime: number,
  logs: ActionLog[]
): Promise<void> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.utils.book_new();

  const postMetadata = posts.map((p) => ({
    id: p.id,
    content: p.content,
    quality: p.quality,
    sourceLevel: p.sourceLevel,
    stance: p.stance,
  }));
  const wsPost = XLSX.utils.json_to_sheet(postMetadata);
  XLSX.utils.book_append_sheet(workbook, wsPost, "Post Metadata");

  const behaviorRows = buildFlatBehaviorRows(startTime, endTime, logs);
  const wsBehavior = XLSX.utils.json_to_sheet(behaviorRows);
  XLSX.utils.book_append_sheet(workbook, wsBehavior, "User Behavior Logs");

  XLSX.writeFile(workbook, "experiment_results.xlsx");
}

export function BehaviorExperiment() {
  const [isMounted, setIsMounted] = useState(false);
  const [posts, setPosts] = useState<PostItemWithAvatar[]>([]);
  const [liked, setLiked] = useState<Record<number, boolean>>({});
  const [shareCount, setShareCount] = useState(0);
  const [logs, setLogs] = useState<ActionLog[]>([]);
  const logsRef = useRef<ActionLog[]>([]);
  const [remainingMs, setRemainingMs] = useState(EXPERIMENT_DURATION_MS);
  const [phase, setPhase] = useState<"running" | "ended">("running");
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [currentSharePostId, setCurrentSharePostId] = useState<number | null>(
    null
  );
  const startTimeRef = useRef<number | null>(null);
  const endedRef = useRef(false);

  useEffect(() => {
    const ordered = shuffleDisplayOrder(
      structuredClone(EXPERIMENT_MATERIALS)
    );
    setPosts(enrichPostsForDisplay(ordered));
    startTimeRef.current = Date.now();
    setIsMounted(true);
  }, []);

  useLayoutEffect(() => {
    logsRef.current = logs;
  }, [logs]);

  const finalize = useCallback(
    async (endTime: number) => {
      if (endedRef.current) return;
      endedRef.current = true;
      setPhase("ended");
      try {
        await exportToExcel(
          posts,
          startTimeRef.current ?? endTime,
          endTime,
          logsRef.current
        );
      } catch (e) {
        console.error(e);
      }
    },
    [posts]
  );

  useEffect(() => {
    if (!isMounted || phase !== "running") return;
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
  }, [isMounted, phase]);

  useEffect(() => {
    if (!isMounted || phase !== "running") return;
    if (remainingMs > 0) return;
    void finalize(Date.now());
  }, [isMounted, remainingMs, phase, finalize]);

  useEffect(() => {
    if (phase !== "running") {
      setIsShareModalOpen(false);
      setCurrentSharePostId(null);
    }
  }, [phase]);

  const closeShareModal = useCallback(() => {
    setIsShareModalOpen(false);
    setCurrentSharePostId(null);
  }, []);

  const handleLike = (e: MouseEvent<HTMLButtonElement>, postId: number) => {
    e.stopPropagation();
    if (!isMounted || phase !== "running") return;
    setLiked((prev) => ({ ...prev, [postId]: !prev[postId] }));
    setLogs((logPrev) => [
      ...logPrev,
      { action: "like", postId, timestamp: Date.now() },
    ]);
  };

  /** 打开转发确认弹窗（不写入日志）。 */
  const handleShareClick = (e: MouseEvent<HTMLButtonElement>, postId: number) => {
    e.stopPropagation();
    if (!isMounted || phase !== "running") return;
    if (shareCount >= 2) return;

    const prevLogs = logsRef.current;
    if (prevLogs.some((l) => l.action === "share" && l.postId === postId)) {
      return;
    }
    const shareSoFar = prevLogs.filter(
      (l): l is ShareLog => l.action === "share"
    ).length;
    if (shareSoFar >= 2) return;

    setCurrentSharePostId(postId);
    setIsShareModalOpen(true);
  };

  const handleShareModalCancel = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    closeShareModal();
  };

  /** 日志仅在弹窗「确认」后追加一次；不得写在 setShareCount 的 updater 内。 */
  const handleShareModalConfirm = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    const postId = currentSharePostId;
    if (postId == null || !isMounted || phase !== "running") {
      closeShareModal();
      return;
    }
    if (shareCount >= 2) {
      closeShareModal();
      return;
    }

    const prevLogs = logsRef.current;
    if (prevLogs.some((l) => l.action === "share" && l.postId === postId)) {
      closeShareModal();
      return;
    }
    const shareSoFar = prevLogs.filter(
      (l): l is ShareLog => l.action === "share"
    ).length;
    if (shareSoFar >= 2) {
      closeShareModal();
      return;
    }

    const ts = Date.now();
    const nextOrder = shareSoFar + 1;
    const newLog: ShareLog = {
      action: "share",
      postId,
      timestamp: ts,
      order: nextOrder,
    };
    const nextLogs = [...prevLogs, newLog];
    logsRef.current = nextLogs;
    setLogs(nextLogs);
    setShareCount((c) => (c >= 2 ? c : c + 1));
    closeShareModal();
  };

  const onEndClick = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (!isMounted || shareCount < 2) return;
    void finalize(Date.now());
  };

  const shareLocked = shareCount >= 2;

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-[480px] flex-col bg-white text-neutral-900">
      {phase === "ended" ? (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-white px-6 text-center">
          <p className="text-xl font-semibold text-neutral-900">
            实验结束，感谢参与
          </p>
          <p className="mt-3 text-sm text-neutral-500">
            数据已导出为本地 Excel 文件
          </p>
        </div>
      ) : null}

      <ShareModal
        open={isShareModalOpen && currentSharePostId != null}
        onCancel={handleShareModalCancel}
        onConfirm={handleShareModalConfirm}
      />

      <header className="sticky top-0 z-20 shrink-0 border-b border-neutral-200 bg-white/95 shadow-[0_1px_0_rgba(0,0,0,0.06)] backdrop-blur-sm">
        <div className="px-4 pb-3 pt-3">
          <h1 className="text-[18px] font-bold leading-snug text-neutral-900">
            战争中应不应该使用AI决策？
          </h1>
          <p className="mt-2 text-[14px] leading-relaxed text-neutral-600">
            就在美伊战争首日，伊南部一所小学被“战斧”导弹夷为平地。美国方面披露的信息显示，美军的错误情报叠加AI决策的双重失误酿成了这场悲剧。那么，AI是否应该参与战争？AI决策的边界在哪里？战争是否已进入“虽然名义上有人类在场，但扣动扳机的却是AI”的时代？
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded bg-neutral-100 px-2 py-0.5 text-[12px] text-neutral-600">
              人工智能
            </span>
            <span className="rounded bg-neutral-100 px-2 py-0.5 text-[12px] text-neutral-600">
              伦理
            </span>
          </div>
        </div>
      </header>

      <main
        className="min-h-0 flex-1 overflow-y-auto pb-24"
        aria-busy={!isMounted}
      >
        <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-2.5 text-[13px] text-neutral-600">
          <span>默认</span>
          <span>全部内容 24</span>
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
            {posts.map((post) => {
              const isLiked = !!liked[post.id];
              const hasSharedThisPost = logs.some(
                (l) => l.action === "share" && l.postId === post.id
              );
              const shareDisabled =
                phase !== "running" || shareLocked || hasSharedThisPost;
              return (
                <PostCard
                  key={post.id}
                  post={post}
                  isLiked={isLiked}
                  hasShared={hasSharedThisPost}
                  shareDisabled={shareDisabled}
                  interactionsDisabled={phase !== "running"}
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
        isRunning={phase === "running"}
        onEndClick={onEndClick}
      />
    </div>
  );
}
