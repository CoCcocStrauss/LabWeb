"use client";
export function ReadingStatus({
  remainingMs,
  shares,
  title,
  topicLabel,
}: {
  remainingMs: number;
  shares: number;
  title: string;
  topicLabel?: string;
}) {
  const seconds = Math.ceil(remainingMs / 1000),
    time = `${Math.floor(seconds / 60)
      .toString()
      .padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
  return (
    <header className="reading-status" aria-label="阅读任务进度">
      {topicLabel ? <p className="study-meta mb-1 text-neutral-500">{topicLabel}</p> : null}
      <h1 className="reading-topic">{title}</h1>
      <div className="reading-status-line">
        <span className="reading-clock">
          剩余 <strong>{time}</strong>
        </span>
        <span className="reading-shares">已转发 {shares} 条（至少 2 条）</span>
      </div>
      <div
        className="reading-meter time-meter"
        role="progressbar"
        aria-label="剩余时间"
        aria-valuemin={0}
        aria-valuemax={150}
        aria-valuenow={Math.min(150, seconds)}
      >
        <span style={{ width: `${Math.min(100, remainingMs / 1500)}%` }} />
      </div>
    </header>
  );
}
