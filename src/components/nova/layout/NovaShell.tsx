import { TopBar } from "./TopBar";
import { Sidebar } from "./Sidebar";
import { BottomNav } from "./BottomNav";

export function NovaShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen lg:flex bg-background text-on-surface">
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar />
        <main className="flex-1 pb-28 lg:pb-0">
          {children}
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
