import type { ReactNode } from "react";
import { MockDataToggle } from "./mock-data-toggle";
import { BottomNav, Sidebar } from "./nav";

/**
 * Shared dashboard chrome — sidebar on desktop, bottom tab bar on mobile —
 * for the secondary routes (History, Settings).
 */
export function PageShell({
  title,
  intro,
  children,
}: {
  title: string;
  intro: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh bg-canvas">
      <Sidebar />
      <main className="flex min-w-0 flex-1 flex-col">
        {/* `relative` anchors the floating Mock Data toggle to the right edge
            of the main pane, while the page content stays in its centered
            820px column. This keeps the toggle's position consistent with
            Overview / Motion, which fill the full width. */}
        <div className="relative flex-1">
          <div className="absolute right-[18px] top-5 z-10 lg:right-11 lg:top-9">
            <MockDataToggle />
          </div>
          <div className="mx-auto w-full max-w-[820px] px-[18px] pb-[140px] pt-5 lg:px-11 lg:pt-9 lg:pb-12">
            <header className="mb-5 pr-[120px]">
              <h1 className="text-[28px] font-bold tracking-[-0.01em] text-ink lg:text-[36px]">
                {title}
              </h1>
              <p className="mt-1 text-[18px] leading-relaxed text-ink-2">
                {intro}
              </p>
            </header>
            {children}
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
