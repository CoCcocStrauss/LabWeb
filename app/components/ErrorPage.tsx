export function ErrorPage() {
  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-[480px] flex-col items-center justify-center bg-white px-6 text-center text-neutral-900 md:max-w-[640px]">
      <p className="text-xl font-semibold">无法开始实验</p>
      <p className="mt-3 text-[14px] leading-relaxed text-neutral-600">
        链接参数不完整或无效。请通过问卷平台提供的正确链接进入，至少需包含{" "}
        <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-[13px]">
          uid
        </code>{" "}
        参数（被试唯一标识）。
      </p>
      <p className="mt-3 text-[13px] leading-relaxed text-neutral-500">
        条件分组（N × 议题）会根据 uid 自动分配，无需额外传参；如需 QA
        指定某一组合，可同时附加{" "}
        <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-[13px]">
          n
        </code>{" "}
        （8、16 或 48）与{" "}
        <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-[13px]">
          topic
        </code>{" "}
        （fertility / ai / eldercare），两者需同时提供且合法。
      </p>
      <p className="mt-4 text-[13px] text-neutral-500">
        自动分组示例：/?uid=credamo_12345
        <br />
        QA 指定示例：/?uid=credamo_12345&amp;n=16&amp;topic=fertility
      </p>
    </div>
  );
}
