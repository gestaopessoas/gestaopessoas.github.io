"use client"

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { UserProfile } from "@/components/layout/UserProfile";
import { Search, Loader2 } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  // ponytail: client-side guard only (UX/defense-in-depth). Static export has no
  // middleware in production, so the real barrier is Supabase RLS on the tables.
  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.replace("/login");
      else setChecking(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.replace("/login");
    });

    return () => sub.subscription.unsubscribe();
  }, [router]);

  if (checking) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background print:h-auto print:block print:bg-transparent">
      {/* Sidebar - fixed on desktop */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden print:overflow-visible print:block">
        {/* Sticky Header */}
        <header className="print:hidden sticky top-0 z-10 flex h-16 shrink-0 items-center justify-between border-b bg-background/95 px-6 backdrop-blur">
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
            <NotificationBell />
            <UserProfile />
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto bg-muted/10 p-6 print:overflow-visible print:bg-transparent print:p-0">
          <div className="mx-auto max-w-7xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
