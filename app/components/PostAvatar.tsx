"use client";

import { useEffect, useState } from "react";

import { hashDisplayNameToAvatarBg } from "../data/avatarPool";
import type { SourceLevel } from "../lib/blockRandomize";

export type PostAvatarProps = {
  sourceLevel: SourceLevel;
  displayName: string;
  avatarFile?: string;
  postId: string | number;
};

export function PostAvatar({
  sourceLevel,
  displayName,
  avatarFile,
  postId,
}: PostAvatarProps) {
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [postId, avatarFile, displayName]);

  const letter = displayName.charAt(0).toUpperCase();
  const bg = hashDisplayNameToAvatarBg(displayName);

  // 认证用户加细金色描边，非认证无描边
  const ringClass =
    sourceLevel === "high"
      ? "ring-[1.5px] ring-amber-400 ring-offset-[2px]"
      : "";

  const fallbackCircle = (
    <div
      className={`flex h-11 w-11 shrink-0 select-none items-center justify-center rounded-full text-[15px] font-semibold leading-none text-white shadow-sm ${ringClass}`}
      style={{ backgroundColor: bg }}
      aria-hidden
    >
      {letter}
    </div>
  );

  const showImage =
    sourceLevel === "high" && Boolean(avatarFile) && !imgFailed;

  if (!showImage) {
    return fallbackCircle;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- 按需求使用原生 img + object-cover；失败时 onError 回退
    <img
      src={`/avatars/${avatarFile}`}
      alt=""
      className={`h-11 w-11 shrink-0 rounded-full object-cover ${ringClass}`}
      loading="lazy"
      onError={() => setImgFailed(true)}
    />
  );
}
