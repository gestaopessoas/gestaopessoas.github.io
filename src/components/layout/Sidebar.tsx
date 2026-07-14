"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { useState } from "react"
import { Archive, Armchair, BarChart3, Briefcase, ClipboardList, FileText, LayoutDashboard, LockKeyhole, LogOut, Settings, Users, ChevronLeft, ChevronRight } from "lucide-react"

const sidebarItems = [
  { name: "Visão Geral", href: "/dashboard", icon: LayoutDashboard },
  { name: "Vagas", href: "/dashboard/vagas", icon: Briefcase },
  { name: "Talentos", href: "/dashboard/talentos", icon: Users },
  { name: "Colaboradores", href: "/dashboard/colaboradores", icon: Users },
  { name: "Arquivo Morto", href: "/dashboard/arquivo-morto", icon: Archive },
  { name: "Armários", href: "/dashboard/armarios", icon: LockKeyhole },
  { name: "Mesas & Ilhas", href: "/dashboard/mesas", icon: Armchair },
  { name: "Controle RGS", href: "/dashboard/rgs", icon: ClipboardList },
  { name: "Admissão", href: "/dashboard/admissao", icon: FileText },
  { name: "Centros de Custo", href: "/dashboard/centros-de-custo", icon: Briefcase },
  { name: "Empresas", href: "/dashboard/empresas", icon: LayoutDashboard },
  { name: "Obras", href: "/dashboard/obras", icon: LayoutDashboard },
  { name: "Analytics", href: "/dashboard/analytics", icon: BarChart3 },
  { name: "Configurações", href: "/dashboard/configuracoes", icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const [isCollapsed, setIsCollapsed] = useState(false)

  return (
    <aside 
      className={cn(
        "h-screen border-r border-border/50 bg-background/60 backdrop-blur-xl flex flex-col transition-all duration-300 relative z-20 shrink-0",
        isCollapsed ? "w-[72px]" : "w-64"
      )}
    >
      <div className={cn("h-16 flex items-center border-b border-border/50 shrink-0 transition-all duration-300", isCollapsed ? "justify-center px-0" : "px-6")}>
        <span className="text-lg font-bold tracking-tight text-foreground flex items-center whitespace-nowrap overflow-hidden">
          <span className="text-primary mr-1">//</span>
          <span className={cn("transition-opacity duration-300", isCollapsed ? "opacity-0 w-0" : "opacity-100")}>
            Gente & Gestão
          </span>
        </span>
      </div>

      <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-1 scrollbar-hide">
        {sidebarItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
          return (
            <div key={item.name} className="relative group/nav-item">
              <Link
                href={item.href}
                className={cn(
                  "flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200",
                  isCollapsed ? "justify-center" : "",
                  isActive
                    ? "bg-muted text-foreground shadow-sm border border-border/50"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )}
              >
                <item.icon
                  className={cn(
                    "h-5 w-5 shrink-0 transition-colors",
                    !isCollapsed && "mr-3",
                    isActive ? "text-primary" : "text-muted-foreground group-hover/nav-item:text-foreground"
                  )}
                  aria-hidden="true"
                />
                {!isCollapsed && <span className="truncate whitespace-nowrap">{item.name}</span>}
              </Link>
              {isCollapsed && (
                <div className="absolute left-full ml-4 top-1/2 -translate-y-1/2 px-2.5 py-1.5 bg-foreground text-background text-xs font-medium rounded opacity-0 invisible group-hover/nav-item:opacity-100 group-hover/nav-item:visible transition-all duration-200 z-50 whitespace-nowrap">
                  {item.name}
                  <div className="absolute top-1/2 -left-1 -translate-y-1/2 border-[5px] border-transparent border-r-foreground" />
                </div>
              )}
            </div>
          )
        })}
      </nav>

      <div className="p-3 border-t border-border/50 shrink-0 space-y-1 relative">
        {/* Floating Collapse Toggle */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute -right-3 top-1/2 -translate-y-1/2 bg-background border border-border/50 rounded-full p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 shadow-sm transition-all duration-200 z-50"
          title={isCollapsed ? "Expandir menu" : "Retrair menu"}
        >
          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>

        <div className="relative group/nav-item">
          <button 
            className={cn(
              "flex w-full items-center px-3 py-2 text-sm font-medium text-muted-foreground rounded-lg transition-all duration-200 hover:bg-muted/50 hover:text-destructive",
              isCollapsed ? "justify-center" : ""
            )}
          >
            <LogOut className={cn("h-5 w-5 shrink-0 transition-colors group-hover/nav-item:text-destructive", !isCollapsed && "mr-3")} />
            {!isCollapsed && <span className="whitespace-nowrap">Sair</span>}
          </button>
          {isCollapsed && (
            <div className="absolute left-full ml-4 top-1/2 -translate-y-1/2 px-2.5 py-1.5 bg-destructive text-destructive-foreground text-xs font-medium rounded opacity-0 invisible group-hover/nav-item:opacity-100 group-hover/nav-item:visible transition-all duration-200 z-50 whitespace-nowrap">
              Sair
              <div className="absolute top-1/2 -left-1 -translate-y-1/2 border-[5px] border-transparent border-r-destructive" />
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}
