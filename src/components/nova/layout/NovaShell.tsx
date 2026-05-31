import { TopBar } from "./TopBar";
import { Sidebar } from "./Sidebar";
import { BottomNav } from "./BottomNav";

export function NovaShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-on-surface">
      {/* Shared full-width top bar (all breakpoints): brand · location · menu */}
      <TopBar />
      {/* Below the bar: sidebar (desktop) | main. On mobile main is full width. */}
      <div className="lg:flex">
        <Sidebar />
        <main className="flex-1 min-w-0 pb-28 lg:pb-0">{children}</main>
      </div>
      <BottomNav />
    </div>
  );
}
