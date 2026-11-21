"use client";

import { useState, type MouseEvent } from "react";

import type { PostCardData } from "./PostCard";
import { PostCard } from "./PostCard";
import { ShareModal } from "./ShareModal";

const DEMO_CONTENT =
  "这是一条示例帖子，请尝试点击下方的转发和点赞按钮进行练习。";

const DEMO_POST_HIGH: PostCardData = {
  id: "demo-high",
  content: DEMO_CONTENT,
  sourceLevel: "high",
  displayName: "知秋观察",
  avatarFile: "v7.jpg",
  identityLabel: "复旦大学社会学系副教授",
  platformLabel: "社会议题话题答主",
};

const DEMO_POST_LOW: PostCardData = {
  id: "demo-low",
  content: DEMO_CONTENT,
  sourceLevel: "low",
  displayName: "xK7mQ2",
};

export type TutorialPageProps = {
  onStart: () => void;
};

export function TutorialPage({ onStart }: TutorialPageProps) {
  const [highLiked, setHighLiked] = useState(false);
  const [lowLiked, setLowLiked] = useState(false);
  const [highShareSuccess, setHighShareSuccess] = useState(false);
  const [lowShareSuccess, setLowShareSuccess] = useState(false);
  const [highLikeSuccess, setHighLikeSuccess] = useState(false);
  const [lowLikeSuccess, setLowLikeSuccess] = useState(false);
  const [sharePracticed, setSharePracticed] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [pendingShareCard, setPendingShareCard] = useState<"high" | "low" | null>(
    null
  );

  const openShareModal = (card: "high" | "low") => (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    setPendingShareCard(card);
    setIsShareModalOpen(true);
  };

  const handleShareConfirm = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (pendingShareCard === "high") {
      setHighShareSuccess(true);
    } else if (pendingShareCard === "low") {
      setLowShareSuccess(true);
    }
    setSharePracticed(true);
    setIsShareModalOpen(false);
    setPendingShareCard(null);
  };

  const handleShareCancel = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    setIsShareModalOpen(false);
    setPendingShareCard(null);
  };

  const handleLikeHigh = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    setHighLiked((prev) => !prev);
    setHighLikeSuccess(true);
  };

  const handleLikeLow = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    setLowLiked((prev) => !prev);
    setLowLikeSuccess(true);
  };

  return (
    <div className="study-shell study-screen">
      <ShareModal
        open={isShareModalOpen}
        onCancel={handleShareCancel}
        onConfirm={handleShareConfirm}
      />

      <main className="study-scroll study-pad study-header pb-6">
        <h1 className="study-title">实验操作说明</h1>

        <div className="study-copy mt-4 space-y-3 text-neutral-700">
          <p>
            我们正在研究社交媒体上的信息传播。请想象这是你真实的社交账号，阅读帖子后
            <strong className="text-neutral-900">选出你最认同的 2 条内容进行转发</strong>。
          </p>
          <div>
            <p className="font-medium text-neutral-800">操作说明：</p>
            <ul className="mt-1.5 list-none space-y-1 pl-0">
              <li>
                · 转发：选择<strong className="text-neutral-900"> 2 条</strong>你认同的内容
              </li>
              <li>· 点赞：可随时点，不计入转发</li>
              <li>
                · 限时<strong className="text-neutral-900"> 90 秒</strong>，转发满 2 条后可继续阅读，也可点击解锁的“结束实验”按钮；倒计时结束会自动结束阅读
              </li>
            </ul>
          </div>
          <p className="pt-1">先用下方练习帖熟悉<strong className="text-neutral-900">转发</strong>操作。练习不计入正式阅读记录，现在尚未开始计时。</p>
        </div>

        <div className="mt-4 divide-y divide-neutral-100 overflow-hidden rounded-lg border border-neutral-200">
          <PostCard
            post={DEMO_POST_HIGH}
            isLiked={highLiked}
            hasShared={false}
            shareDisabled={false}
            sharePracticeSuccess={highShareSuccess}
            likePracticeSuccess={highLikeSuccess}
            onShareClick={openShareModal("high")}
            onLikeClick={handleLikeHigh}
          />
          <PostCard
            post={DEMO_POST_LOW}
            isLiked={lowLiked}
            hasShared={false}
            shareDisabled={false}
            sharePracticeSuccess={lowShareSuccess}
            likePracticeSuccess={lowLikeSuccess}
            onShareClick={openShareModal("low")}
            onLikeClick={handleLikeLow}
          />
        </div>
      </main>

      <footer className="study-footer study-pad border-t border-neutral-200 bg-white">
        <div>
          <button
            type="button"
            disabled={!sharePracticed}
            onClick={onStart}
            className={`study-control w-full rounded-full px-4 py-3 font-medium transition-colors ${
              sharePracticed
                ? "bg-[#0084ff] text-white active:bg-[#0073e6]"
                : "cursor-not-allowed bg-neutral-200 text-neutral-400"
            }`}
          >
            下一步：确认操作规则
          </button>
          {!sharePracticed ? (
            <p className="study-meta mt-2 text-center text-neutral-500">
              请先完成上方的转发练习
            </p>
          ) : null}
        </div>
      </footer>
    </div>
  );
}
