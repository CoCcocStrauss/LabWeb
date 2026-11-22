"use client";
import { useEffect, useRef, useState } from "react";
import { savePretest, type PretestInput } from "../lib/dataSubmit";

/** Saves while the task instructions remain visible; failure never loses the draft. */
export function PretestSync({
  input,
  onSaved,
}: {
  input: PretestInput;
  onSaved: () => boolean;
}) {
  const initial = useRef(input).current;
  const callback = useRef(onSaved);
  callback.current = onSaved;
  const [retry, setRetry] = useState(0);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    setFailed(false);
    void savePretest(initial)
      .then(() => {
        if (active && !callback.current()) setFailed(true);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [initial, retry]);
  return failed ? (
    <div className="mt-4" role="alert">
      <p className="study-meta text-red-700">
        回答尚未保存成功，内容已保留。请重试后继续。
      </p>
      <button
        type="button"
        onClick={() => setRetry((v) => v + 1)}
        className="study-control mt-2 rounded-lg border px-4 py-2"
      >
        重试保存
      </button>
    </div>
  ) : null;
}
