"use client";
import { LABEL_SELECTION_VERSION } from "../lib/labelSelection";
import { Heart, Share2 } from "lucide-react";
import { useRef, type MouseEvent, type Ref } from "react";
import type { PostCardData } from "./PostCard";
import { PostAvatar } from "./PostAvatar";
import { GoldVBadge } from "./GoldVBadge";
import { previewText, type Preview } from "../lib/readingProtocol";
export function PostAuthor({
  post,
  compact = false,
}: {
  post: PostCardData;
  compact?: boolean;
}) {
  const labels =
    post.sourceLevel !== "high"
      ? []
      : post.labelSelectionVersion === LABEL_SELECTION_VERSION
        ? post.displayedLabelText
          ? [post.displayedLabelText]
          : []
        : [post.identityLabel, post.platformLabel].filter(Boolean);
  return (
    <div className={compact ? "feed-author" : "detail-author"}>
      <div className="feed-author-row">
        <div className={compact ? "feed-avatar" : "detail-avatar"}>
          <PostAvatar {...post} postId={post.id} />
        </div>
        <div className="feed-author-text">
          <div className="feed-name-row">
            <span
              className={compact ? "feed-name" : "study-copy font-medium"}
              title={post.displayName}
            >
              {post.displayName}
            </span>
            {post.sourceLevel === "high" ? <GoldVBadge /> : null}
          </div>
          {labels.length ? (
            <div
              className="feed-identities"
              data-label-type={post.displayedLabelType ?? undefined}
              data-label-rule={post.labelSelectionVersion}
            >
              {labels.map((label) => (
                <span key={label}>{label}</span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function PostActions({
  liked,
  shared,
  disabled = false,
  shareDisabled,
  onLike,
  onShare,
}: {
  liked: boolean;
  shared: boolean;
  disabled?: boolean;
  shareDisabled: boolean;
  onLike: (e: MouseEvent<HTMLButtonElement>) => void;
  onShare: (e: MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <div className="feed-actions">
      <button
        type="button"
        aria-pressed={liked}
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          onLike(e);
        }}
        className={liked ? "is-selected" : ""}
      >
        <Heart aria-hidden size={18} fill={liked ? "currentColor" : "none"} />
        <span>{liked ? "已赞" : "点赞"}</span>
      </button>
      <button
        type="button"
        aria-pressed={shared}
        disabled={disabled || shareDisabled}
        onClick={(e) => {
          e.stopPropagation();
          onShare(e);
        }}
        className={shared ? "is-selected" : ""}
      >
        <Share2 aria-hidden size={18} />
        <span>{shared ? "已转发" : "转发"}</span>
      </button>
    </div>
  );
}
export function CompactPostCard({
  post,
  preview,
  liked,
  shared,
  shareDisabled,
  disabled = false,
  rootRef,
  onOpen,
  onCollapse,
  expanded = false,
  presentation = "inline",
  onLike,
  onShare,
}: {
  post: PostCardData;
  preview?: Preview;
  liked: boolean;
  shared: boolean;
  shareDisabled: boolean;
  disabled?: boolean;
  rootRef?: Ref<HTMLElement>;
  onOpen: () => void;
  onCollapse?: () => void;
  expanded?: boolean;
  presentation?: "inline" | "panel";
  onLike: (e: MouseEvent<HTMLButtonElement>) => void;
  onShare: (e: MouseEvent<HTMLButtonElement>) => void;
}) {
  const gesture = useRef<{
    x: number;
    y: number;
    scrollY: number;
    moved: boolean;
  } | null>(null);
  return (
    <article
      ref={rootRef}
      className={`feed-card${!disabled ? " is-interactive" : ""}${expanded ? " is-expanded" : ""}`}
      data-post-id={post.id}
      onPointerDown={(event) => {
        gesture.current = {
          x: event.clientX,
          y: event.clientY,
          scrollY:
            (event.currentTarget.closest(".study-scroll") as HTMLElement | null)
              ?.scrollTop ?? 0,
          moved: false,
        };
      }}
      onPointerMove={(event) => {
        const start = gesture.current;
        if (
          start &&
          Math.hypot(event.clientX - start.x, event.clientY - start.y) > 8
        )
          start.moved = true;
      }}
      onPointerCancel={() => {
        if (gesture.current) gesture.current.moved = true;
      }}
      onClick={(event) => {
        if (
          disabled ||
          (event.target as HTMLElement).closest(
            ".feed-actions,.feed-card-sizing",
          )
        )
          return;
        const start = gesture.current,
          scrollY =
            (event.currentTarget.closest(".study-scroll") as HTMLElement | null)
              ?.scrollTop ?? 0;
        if (
          event.detail > 0 &&
          start &&
          (start.moved || Math.abs(scrollY - start.scrollY) > 4)
        )
          return;
        if (window.getSelection()?.toString()) return;
        if (presentation === "inline" && expanded) onCollapse?.();
        else onOpen();
      }}
    >
      {expanded ? (
        <div className="feed-card-sizing" aria-hidden="true">
          <PostAuthor post={post} compact />
          <div className="feed-content-button">
            <span className="feed-preview">
              {(preview ?? previewText(post.content)).text}
            </span>
            <span className="feed-open">展开全文</span>
          </div>
          <PostActions
            liked={liked}
            shared={shared}
            disabled
            shareDisabled
            onLike={() => {}}
            onShare={() => {}}
          />
        </div>
      ) : null}
      <PostAuthor post={post} compact />
      {expanded && presentation === "inline" ? (
        <div className="feed-content">
          <p className="feed-fulltext study-copy whitespace-pre-wrap">
            {post.content}
          </p>
          <button
            type="button"
            className="feed-collapse"
            disabled={disabled}
            aria-expanded="true"
            onClick={(event) => {
              event.stopPropagation();
              onCollapse?.();
            }}
          >
            收起
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled}
          className="feed-content-button"
          aria-label={`展开${post.displayName}的全文`}
          aria-expanded={presentation === "inline" ? false : undefined}
          aria-haspopup={presentation === "panel" ? "dialog" : undefined}
        >
          <span className="feed-preview">
            {(preview ?? previewText(post.content)).text}
          </span>
          <span className="feed-open">展开全文</span>
        </button>
      )}
      <PostActions
        liked={liked}
        shared={shared}
        disabled={disabled}
        shareDisabled={shareDisabled}
        onLike={onLike}
        onShare={onShare}
      />
    </article>
  );
}
