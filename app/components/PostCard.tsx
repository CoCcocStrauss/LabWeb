"use client";

import { Check, Heart, Share2 } from "lucide-react";
import type { MouseEvent, Ref } from "react";

import type { SourceLevel } from "../lib/blockRandomize";
import { GoldVBadge } from "./GoldVBadge";
import { PostAvatar } from "./PostAvatar";

export type PostCardData = {
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
    <article ref={rootRef} className="px-4 py-4">
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
            <span className="text-[15px] font-medium text-neutral-900">
              {post.displayName}
            </span>
            {highSource ? <GoldVBadge /> : null}
            {hasPlatformLabel ? (
              <span className="text-[11px] leading-none text-neutral-400">
                {post.platformLabel}
              </span>
            ) : null}
          </div>
          {/* 第二行：身份类标签（独占一行，昵称下方小字） */}
          {hasIdentityLabel ? (
            <p className="mt-0.5 text-[12px] leading-snug text-neutral-500">
              {post.identityLabel}
            </p>
          ) : null}
          <p className="mt-2 whitespace-pre-wrap break-words text-[15px] leading-[1.65] text-neutral-800">
            {post.content}
          </p>
          <div className="mt-3 flex flex-wrap items-center justify-end gap-x-6 gap-y-2 text-[13px]">
            <div className="inline-flex items-center gap-2">
              <button
                type="button"
                className={`inline-flex items-center gap-1.5 transition-colors ${
                  hasShared
                    ? "cursor-not-allowed text-red-600"
                    : shareDisabled
                      ? "cursor-not-allowed text-neutral-300"
                      : "text-gray-500 active:text-neutral-700"
                }`}
                disabled={shareDisabled || interactionsDisabled}
                onClick={onShareClick}
              >
                <Share2 className="h-4 w-4 shrink-0" strokeWidth={2} />
                <span>{hasShared ? "已转发" : "转发"}</span>
              </button>
              {sharePracticeSuccess ? (
                <span className="inline-flex items-center gap-1 text-green-600">
                  <Check className="h-4 w-4 shrink-0" strokeWidth={2.5} />
                  <span>操作正确！</span>
                </span>
              ) : null}
            </div>
            <div className="inline-flex items-center gap-2">
              <button
                type="button"
                className={`inline-flex items-center gap-1.5 transition-colors ${
                  isLiked
                    ? "text-red-600 active:text-red-700"
                    : "text-gray-500 active:text-neutral-700"
                }`}
                disabled={interactionsDisabled}
                onClick={onLikeClick}
              >
                <Heart
                  className={`h-4 w-4 shrink-0 ${
                    isLiked ? "fill-red-600 text-red-600" : "fill-none"
                  }`}
                  strokeWidth={2}
                />
                <span>点赞</span>
              </button>
              {likePracticeSuccess ? (
                <span className="inline-flex items-center gap-1 text-green-600">
                  <Check className="h-4 w-4 shrink-0" strokeWidth={2.5} />
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
