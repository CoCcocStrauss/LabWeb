"use client";
import { Heart, Share2 } from "lucide-react";
import type { MouseEvent, Ref } from "react";
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
  return (
    <div className={compact ? "feed-author" : "detail-author"}>
      <div className={compact ? "feed-author-row" : "flex items-center gap-3"}>
        <div className={compact ? "feed-avatar" : ""}>
          <PostAvatar {...post} postId={post.id} />
        </div>
        <span
          className={compact ? "feed-name" : "study-copy font-medium"}
          title={post.displayName}
        >
          {post.displayName}
        </span>
        {post.sourceLevel === "high" ? <GoldVBadge /> : null}
      </div>
      {post.sourceLevel === "high" ? (
        <div className="feed-identities">
          {[post.identityLabel, post.platformLabel]
            .filter(Boolean)
            .map((label) => (
              <span key={label}>{label}</span>
            ))}
        </div>
      ) : null}
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
  onLike: (e: MouseEvent<HTMLButtonElement>) => void;
  onShare: (e: MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <article
      ref={rootRef}
      className={`feed-card${disabled ? "" : " is-interactive"}`}
      data-post-id={post.id}
      onClick={(event) => {
        if (
          !disabled &&
          !(event.target as HTMLElement).closest(".feed-actions button")
        )
          onOpen();
      }}
    >
      <PostAuthor post={post} compact />
      <button
        type="button"
        disabled={disabled}
        className="feed-content-button"
        aria-label={`查看${post.displayName}的全文`}
        aria-haspopup="dialog"
      >
        <span className="feed-preview">
          {(preview ?? previewText(post.content)).text}
        </span>
        <span className="feed-open">查看全文</span>
      </button>
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
