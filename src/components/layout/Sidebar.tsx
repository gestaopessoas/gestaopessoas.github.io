"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Home, 
  Users, 
  Building2, 
  MapPin, 
  Briefcase 
} from "lucide-react";

const mainNav = { name: "Home", href: "/dashboard", icon: Home };

const navigationGroups = [
  {
    name: "Core HR",
    items: [
      { name: "Colaboradores", href: "/dashboard/colaboradores", icon: Users },
      { name: "Centros de Custo", href: "/dashboard/centros-de-custo", icon: Briefcase },
    ],
  },
  {
    name: "Organização",
    items: [
      { name: "Empresas", href: "/dashboard/empresas", icon: Building2 },
      { name: "Obras", href: "/dashboard/obras", icon: MapPin },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname() || "";

  return (
    <div className="flex h-full w-64 flex-col border-r bg-background">
      <div className="flex h-16 items-center border-b px-6">
        <Link href="/dashboard" className="flex items-center gap-2 font-bold tracking-tight">
          <div className="h-6 w-6 rounded bg-primary" />
          <span className="text-lg">ATS Core HR</span>
        </Link>
      </div>
      
      <div className="flex-1 overflow-auto py-4">
        <nav className="space-y-6 px-4">
          <div className="space-y-1">
            <Link
              href={mainNav.href}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                pathname === mainNav.href
                  ? "bg-muted text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-primary"
              }`}
            >
              <mainNav.icon className="h-4 w-4" />
              {mainNav.name}
            </Link>
          </div>
          
          {navigationGroups.map((group) => (
            <div key={group.name} className="space-y-2">
              <h4 className="px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {group.name}
              </h4>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const isActive = pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                        isActive
                          ? "bg-muted text-primary"
                          : "text-muted-foreground hover:bg-muted hover:text-primary"
                      }`}
                    >
                      <item.icon className="h-4 w-4" />
                      {item.name}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>
    </div>
  );
}
