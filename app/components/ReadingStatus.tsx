"use client";
export function ReadingStatus({
  remainingMs,
  shares,
  title,
}: {
  remainingMs: number;
  shares: number;
  title: string;
}) {
  const seconds = Math.ceil(remainingMs / 1000),
    time = `${Math.floor(seconds / 60)
      .toString()
      .padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
  return (
    <header className="reading-status" aria-label="阅读任务进度">
      <h1 className="reading-topic">{title}</h1>
      <div className="reading-status-line">
        <span
          className={`reading-clock ${remainingMs <= 30000 ? "is-urgent" : ""} ${remainingMs <= 3000 ? "is-final" : ""}`}
        >
          剩余 <strong>{time}</strong>
        </span>
        <span className="reading-shares">已转发{shares}／2条</span>
      </div>
      <div
        className="reading-meter time-meter"
        role="progressbar"
        aria-label="剩余时间"
        aria-valuemin={0}
        aria-valuemax={90}
        aria-valuenow={Math.min(90, seconds)}
      >
        <span
          className={remainingMs <= 30000 ? "is-urgent" : ""}
          style={{ width: `${Math.min(100, remainingMs / 900)}%` }}
        />
      </div>
    </header>
  );
}
