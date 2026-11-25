/** Plain markup also works before hydration, when the JavaScript is still loading. */
export function PageLoading({
  failed = false,
  error,
}: {
  failed?: boolean;
  error?: Error | null;
}) {
  const unavailable = failed || !!error;
  return (
    <main className="study-shell study-page flex flex-col items-center justify-center text-center">
      <h1 className="study-title" aria-live={unavailable ? "assertive" : "polite"}>
        {unavailable ? "页面暂时未能加载" : "页面加载中…"}
      </h1>
      <div className={unavailable ? "mt-5" : "page-load-help mt-5"}>
        <p className="study-copy text-neutral-700">
          {unavailable
            ? "请检查网络连接后重新加载。若仍无法打开，请联系实验员。"
            : "加载时间较长，请检查网络连接后重试。"}
        </p>
        <p className="study-meta mt-3 text-neutral-600">
          已保存的进度不会清除，请勿清除浏览器数据。
        </p>
        {/* A native link works even if hydration or the next chunk fails. */}
        <a
          href=""
          className="study-control mt-6 inline-block rounded-full bg-[#0084ff] px-8 py-3 text-white"
        >
          重新加载页面
        </a>
      </div>
      <noscript>
        <p className="study-copy mt-5">请开启浏览器的 JavaScript 后再试。</p>
      </noscript>
    </main>
  );
}
