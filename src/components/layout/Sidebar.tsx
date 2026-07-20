"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { useState, useEffect } from "react"
import { Archive, Armchair, BarChart3, Briefcase, ClipboardList, FileText, LayoutDashboard, LockKeyhole, LogOut, Settings, Users, ChevronLeft, ChevronRight, ChevronDown, GraduationCap, CalendarDays, Gift, Clock, Receipt, Star, Smile, Target, TrendingUp, RefreshCcw, Award, Package, CheckSquare } from "lucide-react"
import { usePermissions } from "@/hooks/usePermissions"
import { createClient } from "@/utils/supabase/client"

const sidebarGroups = [
  {
    name: "Geral",
    items: [
      { name: "Visão Geral", href: "/dashboard", icon: LayoutDashboard },
      { name: "Formulários", href: "/dashboard/formularios", icon: FileText, module: "formularios" },
    ]
  },
  {
    name: "Recrutamento & Seleção",
    items: [
      { name: "Vagas", href: "/dashboard/vagas", icon: Briefcase, module: "vagas" },
      { name: "Entrevistas", href: "/dashboard/entrevistas", icon: Users, module: "entrevistas" },
      { name: "Talentos", href: "/dashboard/talentos", icon: Users, module: "talentos" },
    ]
  },
  {
    name: "Departamento Pessoal",
    items: [
      { name: "Admissão", href: "/dashboard/admissao", icon: FileText, module: "admissao" },
      { name: "Ponto", href: "/dashboard/ponto", icon: Clock, module: "ponto" },
      { name: "Férias", href: "/dashboard/ferias", icon: CalendarDays, module: "ferias" },
      { name: "Holerites", href: "/dashboard/holerites", icon: Receipt, module: "holerites" },
      { name: "Arquivo Morto", href: "/dashboard/arquivo-morto", icon: Archive, module: "arquivo_morto" },
      { name: "Controle RGS", href: "/dashboard/rgs", icon: ClipboardList, module: "rgs" },
    ]
  },
  {
    name: "Gestão & Desenvolvimento",
    items: [
      { name: "Colaboradores", href: "/dashboard/colaboradores", icon: Users, module: "colaboradores" },
      { name: "Integração (Onboarding)", href: "/dashboard/onboarding", icon: CheckSquare, module: "onboarding" },
      { name: "Treinamentos", href: "/dashboard/treinamentos", icon: GraduationCap, module: "treinamentos" },
      { name: "Avaliações", href: "/dashboard/avaliacoes", icon: Star, module: "avaliacoes" },
      { name: "Metas", href: "/dashboard/metas", icon: Target, module: "metas" },
      { name: "PDI", href: "/dashboard/pdi", icon: TrendingUp, module: "pdi" },
      { name: "Competências", href: "/dashboard/competencias", icon: Award, module: "competencias" },
      { name: "Turnover", href: "/dashboard/turnover", icon: RefreshCcw, module: "turnover" },
      { name: "Clima", href: "/dashboard/clima", icon: Smile, module: "clima" },
    ]
  },
  {
    name: "Facilities & Benefícios",
    items: [
      { name: "Benefícios", href: "/dashboard/beneficios", icon: Gift, module: "beneficios" },
      { name: "Tipos de Benefício", href: "/dashboard/tipos-beneficios", icon: Gift, module: "beneficios" },
      { name: "Armários", href: "/dashboard/armarios", icon: LockKeyhole, module: "armarios" },
      { name: "Mesas & Ilhas", href: "/dashboard/mesas", icon: Armchair, module: "ilhas" },
      { name: "Uniformes & EPIs", href: "/dashboard/uniformes", icon: Package, module: "uniformes" },
    ]
  },
  {
    name: "Administrativo",
    items: [
      { name: "Centros de Custo", href: "/dashboard/centros-de-custo", icon: Briefcase, module: "centros_de_custo" },
      { name: "Departamentos", href: "/dashboard/departamentos", icon: Briefcase, module: "departamentos" },
      { name: "Cargos", href: "/dashboard/cargos", icon: Briefcase, module: "cargos" },
      { name: "Empresas", href: "/dashboard/empresas", icon: LayoutDashboard, module: "empresas" },
      { name: "Obras", href: "/dashboard/obras", icon: LayoutDashboard, module: "obras" },
      { name: "Analytics", href: "/dashboard/analytics", icon: BarChart3, module: "analytics" },
      { name: "Configurações", href: "/dashboard/configuracoes", icon: Settings, module: "configuracoes" },
    ]
  }
];

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>(() => {
    if (typeof window === "undefined") return {}
    try {
      return JSON.parse(localStorage.getItem("sidebar-collapsed-groups") ?? "{}") as Record<string, boolean>
    } catch {
      return {}
    }
  })
  const { loading, can } = usePermissions()

  useEffect(() => {
    localStorage.setItem("sidebar-collapsed-groups", JSON.stringify(collapsedGroups))
  }, [collapsedGroups])

  const toggleGroup = (name: string) =>
    setCollapsedGroups((prev) => ({ ...prev, [name]: !prev[name] }))

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/login")
  }

  return (
    <aside 
      className={cn(
        "h-screen border-r border-border/50 bg-background/60 backdrop-blur-xl flex flex-col transition-all duration-300 relative z-20 shrink-0 print:hidden",
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

      <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-6 scrollbar-hide">
        {sidebarGroups.map((group, groupIdx) => {
          const groupVisibleItems = group.items.filter((item) => loading || !item.module || can(item.module, "view"))
          
          if (groupVisibleItems.length === 0) return null;

          const isGroupCollapsed = !isCollapsed && !!collapsedGroups[group.name]

          return (
            <div key={group.name} className="space-y-1">
              {!isCollapsed && (
                <button
                  onClick={() => toggleGroup(group.name)}
                  className="w-full flex items-center justify-between px-3 mb-1 group/group-header"
                >
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider group-hover/group-header:text-foreground transition-colors">{group.name}</h3>
                  <ChevronDown
                    className={cn(
                      "h-3 w-3 text-muted-foreground group-hover/group-header:text-foreground transition-all duration-200",
                      isGroupCollapsed ? "-rotate-90" : "rotate-0"
                    )}
                  />
                </button>
              )}
              {isCollapsed && groupIdx > 0 && <div className="h-px bg-border/50 mx-4 my-4" />}
              
              {!isGroupCollapsed && groupVisibleItems.map((item) => {
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
                      title={isCollapsed ? item.name : undefined}
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
                  </div>
                )
              })}
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
            onClick={handleSignOut}
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
