/** 微博风格金 V：红底、细金边、居中金色粗体 V（仅高信源展示） */
export function GoldVBadge() {
  return (
    <span
      className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-amber-400 bg-red-600"
      aria-label="高信源认证"
      title="高信源"
    >
      <span className="translate-y-px text-xs font-bold leading-none text-amber-400">
        V
      </span>
    </span>
  );
}
