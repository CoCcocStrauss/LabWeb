"use client";

import { Check, Heart, Share2 } from "lucide-react";
import type { MouseEvent, Ref } from "react";

import type { DisplayedLabelSelection } from "../lib/labelSelection";
import type { SourceLevel } from "../lib/blockRandomize";
import { GoldVBadge } from "./GoldVBadge";
import { PostAvatar } from "./PostAvatar";

export type PostCardData = Partial<DisplayedLabelSelection> & {
  id: string | number;
  content: string;
  sourceLevel: SourceLevel;
  displayName: string;
  avatarFile?: string;
  /** 高信源专用：现实职业身份标签（灰色）；null 则不显示 */
  identityLabel?: string | null;
  /** 高信源专用：平台身份/影响力标签（蓝色）；null 则不显示 */
  platformLabel?: string | null;
};

export type PostCardProps = {
  post: PostCardData;
  isLiked: boolean;
  hasShared: boolean;
  shareDisabled: boolean;
  interactionsDisabled?: boolean;
  onShareClick: (e: MouseEvent<HTMLButtonElement>) => void;
  onLikeClick: (e: MouseEvent<HTMLButtonElement>) => void;
  /** 滚动追踪：绑定到帖子根元素 */
  rootRef?: Ref<HTMLElement>;
  /** 教程练习：操作成功后显示绿色反馈 */
  sharePracticeSuccess?: boolean;
  likePracticeSuccess?: boolean;
};

export function PostCard({
  post,
  isLiked,
  hasShared,
  shareDisabled,
  interactionsDisabled = false,
  onShareClick,
  onLikeClick,
  rootRef,
  sharePracticeSuccess = false,
  likePracticeSuccess = false,
}: PostCardProps) {
  const highSource = post.sourceLevel === "high";
  const hasIdentityLabel = highSource && Boolean(post.identityLabel?.trim());
  const hasPlatformLabel = highSource && Boolean(post.platformLabel?.trim());

  return (
    <article ref={rootRef} className="study-pad py-5">
      <div className="flex gap-3">
        <PostAvatar
          sourceLevel={post.sourceLevel}
          displayName={post.displayName}
          avatarFile={post.avatarFile}
          postId={post.id}
        />
        <div className="min-w-0 flex-1">
          {/* 第一行：昵称 · V标 · 平台类标签（三者同行） */}
          <div className="flex flex-wrap items-center gap-1">
            <span className="study-copy font-medium text-neutral-900">
              {post.displayName}
            </span>
            {highSource ? <GoldVBadge /> : null}
            {hasPlatformLabel ? (
              <span className="study-meta text-neutral-500">
                {post.platformLabel}
              </span>
            ) : null}
          </div>
          {/* 第二行：身份类标签（独占一行，昵称下方小字） */}
          {hasIdentityLabel ? (
            <p className="study-meta mt-1 text-neutral-500">
              {post.identityLabel}
            </p>
          ) : null}
          <p className="study-copy mt-3 whitespace-pre-wrap break-words text-neutral-800">
            {post.content}
          </p>
          <div className="study-copy mt-3 flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
            <div className="inline-flex max-w-full flex-wrap items-center gap-2">
              <button
                type="button"
                className={`inline-flex min-h-11 items-center gap-2 px-1 transition-colors ${
                  hasShared
                    ? "cursor-not-allowed text-red-600"
                    : shareDisabled
                      ? "cursor-not-allowed text-neutral-300"
                      : "text-gray-500 active:text-neutral-700"
                }`}
                disabled={shareDisabled || interactionsDisabled}
                onClick={onShareClick}
              >
                <Share2 className="h-5 w-5 shrink-0" strokeWidth={2} />
                <span>{hasShared ? "已转发" : "转发"}</span>
              </button>
              {sharePracticeSuccess ? (
                <span className="study-meta inline-flex items-center gap-1 text-green-600">
                  <Check className="h-5 w-5 shrink-0" strokeWidth={2.5} />
                  <span>操作正确！</span>
                </span>
              ) : null}
            </div>
            <div className="inline-flex max-w-full flex-wrap items-center gap-2">
              <button
                type="button"
                className={`inline-flex min-h-11 items-center gap-2 px-1 transition-colors ${
                  isLiked
                    ? "text-red-600 active:text-red-700"
                    : "text-gray-500 active:text-neutral-700"
                }`}
                disabled={interactionsDisabled}
                onClick={onLikeClick}
              >
                <Heart
                  className={`h-5 w-5 shrink-0 ${
                    isLiked ? "fill-red-600 text-red-600" : "fill-none"
                  }`}
                  strokeWidth={2}
                />
                <span>点赞</span>
              </button>
              {likePracticeSuccess ? (
                <span className="study-meta inline-flex items-center gap-1 text-green-600">
                  <Check className="h-5 w-5 shrink-0" strokeWidth={2.5} />
                  <span>操作正确！</span>
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
