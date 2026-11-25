export function ErrorPage() {
  return (
    <div className="study-shell study-page flex flex-col items-center justify-center text-center">
      <p className="study-title">无法开始实验</p>
      <p className="study-copy mt-3 text-neutral-600">
        链接参数不完整或无效。请通过问卷平台提供的正确链接进入，至少需包含{" "}
        <code className="rounded bg-neutral-100 px-1.5 py-0.5 study-meta">
          uid
        </code>{" "}
        参数（被试唯一标识）。
      </p>
      <p className="study-copy mt-3 text-neutral-500">
        条件分组（N × 议题）会根据 uid 自动分配，无需额外传参；如需 QA
        指定某一组合，可同时附加{" "}
        <code className="rounded bg-neutral-100 px-1.5 py-0.5 study-meta">
          n
        </code>{" "}
        （8、24 或 48）与{" "}
        <code className="rounded bg-neutral-100 px-1.5 py-0.5 study-meta">
          topic
        </code>{" "}
        （fertility / ai），两者需同时提供且合法。
      </p>
      <p className="mt-4 study-meta text-neutral-500">
        自动分组示例：/?uid=credamo_12345
        <br />
        QA 指定示例：/?uid=test_materials_review_01&amp;n=24&amp;topic=fertility
      </p>
    </div>
  );
}
