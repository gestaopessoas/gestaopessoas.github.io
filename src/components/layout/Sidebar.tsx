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
      <div className={cn("h-16 flex items-center border-b border-border/50 shrink-0", isCollapsed ? "justify-center px-0" : "px-6")}>
        {!isCollapsed ? (
          <span className="text-lg font-bold tracking-tight text-foreground flex items-center">
            <span className="text-primary mr-1">//</span>Gente & Gestão
          </span>
        ) : (
          <span className="text-lg font-bold tracking-tight text-primary">//</span>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-1">
        {sidebarItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
          return (
            <Link
              key={item.name}
              href={item.href}
              title={isCollapsed ? item.name : undefined}
              className={cn(
                "group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200",
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
                  isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                )}
                aria-hidden="true"
              />
              {!isCollapsed && <span className="truncate">{item.name}</span>}
            </Link>
          )
        })}
      </nav>

      <div className="p-3 border-t border-border/50 shrink-0 space-y-1">
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={cn(
            "group flex w-full items-center px-3 py-2 text-sm font-medium text-muted-foreground rounded-lg transition-all duration-200 hover:bg-muted/50 hover:text-foreground",
            isCollapsed ? "justify-center" : ""
          )}
          title={isCollapsed ? "Expandir" : "Retrair"}
        >
          {isCollapsed ? (
            <ChevronRight className="h-5 w-5 shrink-0 transition-colors group-hover:text-foreground" />
          ) : (
            <>
              <ChevronLeft className="mr-3 h-5 w-5 shrink-0 transition-colors group-hover:text-foreground" />
              Retrair menu
            </>
          )}
        </button>
        <button 
          title={isCollapsed ? "Sair" : undefined}
          className={cn(
            "group flex w-full items-center px-3 py-2 text-sm font-medium text-muted-foreground rounded-lg transition-all duration-200 hover:bg-muted/50 hover:text-destructive",
            isCollapsed ? "justify-center" : ""
          )}
        >
          <LogOut className={cn("h-5 w-5 shrink-0 transition-colors group-hover:text-destructive", !isCollapsed && "mr-3")} />
          {!isCollapsed && "Sair"}
        </button>
      </div>
    </aside>
  )
}
