"use client";
import { useEffect, useRef, type MouseEvent } from "react";
import type { PostCardData } from "./PostCard";
import { PostAuthor, PostActions } from "./CompactPostCard";
export function PostDetail({
  post,
  liked,
  shared,
  disabled,
  shareDisabled,
  onClose,
  onLike,
  onShare,
}: {
  post: PostCardData;
  liked: boolean;
  shared: boolean;
  disabled: boolean;
  shareDisabled: boolean;
  onClose: () => void;
  onLike: (e: MouseEvent<HTMLButtonElement>) => void;
  onShare: (e: MouseEvent<HTMLButtonElement>) => void;
}) {
  const panel = useRef<HTMLDivElement>(null),
    closeButton = useRef<HTMLButtonElement>(null),
    pointerStart = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeButton.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
      if (e.key === "Tab" && panel.current) {
        const nodes = [
          ...panel.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]),[tabindex="0"]',
          ),
        ];
        const first = nodes[0],
          last = nodes.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      requestAnimationFrame(() => {
        if (previous?.isConnected) previous.focus({ preventScroll: true });
      });
    };
  }, [onClose]);
  return (
    <div className="reading-detail-region">
      <div className="reading-detail-backdrop" aria-hidden onClick={onClose} />
      <div
        ref={panel}
        className="reading-detail"
        role="dialog"
        aria-modal="true"
        aria-label={`${post.displayName}的全文`}
        onPointerDown={(event) => {
          pointerStart.current = { x: event.clientX, y: event.clientY };
        }}
        onClick={(event) => {
          if ((event.target as HTMLElement).closest("button")) return;
          if (window.getSelection()?.toString()) return;
          const start = pointerStart.current;
          if (
            start &&
            Math.hypot(event.clientX - start.x, event.clientY - start.y) > 8
          )
            return;
          onClose();
        }}
      >
        <header className="detail-toolbar">
          <button
            ref={closeButton}
            type="button"
            onClick={onClose}
            className="study-control"
          >
            ← 返回内容
          </button>
          <span className="study-meta text-neutral-500">再点内容可收起</span>
        </header>
        <div
          className="detail-body"
          tabIndex={0}
          onKeyDown={(event) => {
            if (
              event.target === event.currentTarget &&
              (event.key === "Enter" || event.key === " ")
            ) {
              event.preventDefault();
              onClose();
            }
          }}
        >
          <PostAuthor post={post} />
          <p className="study-copy mt-4 whitespace-pre-wrap">{post.content}</p>
        </div>
        <footer className="detail-footer">
          <PostActions
            liked={liked}
            shared={shared}
            disabled={disabled}
            shareDisabled={shareDisabled}
            onLike={onLike}
            onShare={onShare}
          />
        </footer>
      </div>
    </div>
  );
}
