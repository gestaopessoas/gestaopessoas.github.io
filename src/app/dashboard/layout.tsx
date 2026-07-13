import { Sidebar } from "@/components/layout/Sidebar";
import { Bell, Search, User } from "lucide-react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar - fixed on desktop */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Sticky Header */}
        <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center justify-between border-b bg-background/95 px-6 backdrop-blur">
          {/* Breadcrumbs Placeholder */}
          <div className="flex items-center">
            <span className="text-sm font-medium text-muted-foreground">
              Dashboard
            </span>
          </div>

          {/* Right Header actions */}
          <div className="flex items-center gap-4">
            <button className="text-muted-foreground hover:text-primary">
              <Search className="h-5 w-5" />
            </button>
            <button className="text-muted-foreground hover:text-primary">
              <Bell className="h-5 w-5" />
            </button>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
              <User className="h-5 w-5 text-muted-foreground" />
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto bg-muted/10 p-6">
          <div className="mx-auto max-w-7xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
