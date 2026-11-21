import type { ReactNode } from "react";
export function PostTaskFrame({ title, reference, children, footer }: {
  title: string; reference?: string; children: ReactNode; footer: ReactNode;
}) {
  return <div className="study-shell study-screen">
    <header className="questionnaire-header study-header study-pad border-b border-neutral-200">
      <h1 className="study-title">{title}</h1>
      {reference ? <p className="questionnaire-scenario study-copy mt-3 rounded-lg bg-neutral-50 p-3">{reference}</p> : null}
    </header>
    <main className="study-scroll study-pad py-5">{children}</main>
    <footer className="study-footer study-pad border-t border-neutral-200">{footer}</footer>
  </div>;
}
