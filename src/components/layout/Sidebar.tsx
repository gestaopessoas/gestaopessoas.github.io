"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Archive, Armchair, BarChart3, Briefcase, ClipboardList, FileText, LayoutDashboard, LockKeyhole, LogOut, Settings, Users } from "lucide-react"

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

  return (
    <aside className="w-64 h-screen border-r border-border/50 bg-background/60 backdrop-blur-xl flex flex-col fixed left-0 top-0 z-40">
      <div className="h-16 flex items-center px-6 border-b border-border/50">
        <span className="text-lg font-bold tracking-tight text-foreground">
          Gente & Gestão
        </span>
      </div>

      <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-1">
        {sidebarItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200",
                isActive
                  ? "bg-muted text-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              )}
            >
              <item.icon
                className={cn(
                  "mr-3 h-4 w-4 shrink-0 transition-colors",
                  isActive ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
                )}
                aria-hidden="true"
              />
              {item.name}
            </Link>
          )
        })}
      </nav>

      <div className="p-4 border-t border-border/50">
        <button className="group flex w-full items-center px-3 py-2 text-sm font-medium text-muted-foreground rounded-lg transition-all duration-200 hover:bg-muted/50 hover:text-destructive">
          <LogOut className="mr-3 h-4 w-4 shrink-0 transition-colors group-hover:text-destructive" />
          Sair
        </button>
      </div>
    </aside>
  )
}
