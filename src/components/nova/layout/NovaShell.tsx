import { TopBar } from "./TopBar";
import { BottomNav } from "./BottomNav";

export function NovaShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-background text-on-surface">
      <TopBar />
      <main className="flex-1 pb-28 md:pb-0">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
