import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, FileText, Users, X, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { createClient } from "@/utils/supabase/client";
import { useDebounce } from "@/hooks/useDebounce";

const navLinks = [
  { href: "/dashboard", label: "Visão Geral", icon: <FileText className="mr-2 h-4 w-4" /> },
  { href: "/dashboard/colaboradores", label: "Colaboradores", icon: <Users className="mr-2 h-4 w-4" /> },
  { href: "/dashboard/vagas", label: "Vagas", icon: <FileText className="mr-2 h-4 w-4" /> },
  // add others if needed
];

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 300);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "/" && !["INPUT", "TEXTAREA"].includes((e.target as HTMLElement).tagName)) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (!debouncedQuery) {
      setResults([]);
      return;
    }

    const search = async () => {
      setLoading(true);
      const supabase = createClient();
      
      // Search pages
      const pageResults = navLinks
        .filter(l => l.label.toLowerCase().includes(debouncedQuery.toLowerCase()))
        .map(l => ({ ...l, type: 'page' }));

      // Search employees
      const { data: employees } = await supabase
        .from('employees')
        .select('id, name, role')
        .ilike('name', `%${debouncedQuery}%`)
        .limit(5);

      const employeeResults = (employees || []).map(e => ({
        href: `/dashboard/colaboradores?id=${e.id}`, // We could navigate or open modal
        label: e.name,
        description: e.role,
        icon: <Users className="mr-2 h-4 w-4 text-primary" />,
        type: 'employee'
      }));

      setResults([...pageResults, ...employeeResults]);
      setLoading(false);
    };

    search();
  }, [debouncedQuery]);

  const handleSelect = (href: string) => {
    setOpen(false);
    setQuery("");
    router.push(href);
  };

  return (
    <>
      <button 
        onClick={() => setOpen(true)}
        className="text-muted-foreground hover:text-primary relative group flex items-center gap-2 rounded-full bg-muted/50 px-3 py-1.5 transition-colors"
      >
        <Search className="h-4 w-4" />
        <span className="text-sm hidden sm:inline-block">Buscar...</span>
        <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
          /
        </kbd>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[500px] p-0 gap-0 overflow-hidden">
          <DialogHeader className="p-0 border-b">
            <DialogTitle className="sr-only">Busca Global</DialogTitle>
            <DialogDescription className="sr-only">Procure por colaboradores e páginas.</DialogDescription>
            <div className="flex items-center px-3 py-2">
              <Search className="mr-2 h-5 w-5 text-muted-foreground shrink-0" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Busque colaboradores ou páginas..."
                className="flex-1 border-0 focus-visible:ring-0 rounded-none shadow-none text-base bg-transparent px-2"
                autoFocus
              />
              {query && (
                <button onClick={() => setQuery("")} className="p-1 hover:bg-muted rounded-full">
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              )}
            </div>
          </DialogHeader>
          
          <div className="max-h-[300px] overflow-y-auto p-2">
            {loading ? (
              <div className="flex items-center justify-center p-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : results.length === 0 && query ? (
              <div className="text-center p-4 text-sm text-muted-foreground">
                Nenhum resultado encontrado para "{query}"
              </div>
            ) : (
              <div className="space-y-1">
                {results.map((r, i) => (
                  <button
                    key={i}
                    onClick={() => handleSelect(r.href)}
                    className="flex w-full items-center px-2 py-2 text-sm rounded-md hover:bg-muted text-left"
                  >
                    {r.icon}
                    <div>
                      <div className="font-medium">{r.label}</div>
                      {r.description && <div className="text-xs text-muted-foreground">{r.description}</div>}
                    </div>
                  </button>
                ))}
              </div>
            )}
            
            {!query && (
              <div className="text-center p-4 text-xs text-muted-foreground">
                Comece a digitar para buscar colaboradores ou páginas do sistema.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
