import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Endpoint restrito para tabelas que precisam bypassar o RLS do frontend.
// Útil para quando não temos acesso ao dashboard para corrigir as políticas RLS.

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ALLOWED_TABLES = ["benefit_audit_logs", "benefit_ignores", "rgs_processes"];

export async function POST(request: Request) {
  try {
    const { action, table, payload, match } = await request.json();

    if (!ALLOWED_TABLES.includes(table)) {
      return NextResponse.json({ error: "Tabela não permitida" }, { status: 403 });
    }

    if (action === "select") {
      let query = supabase.from(table).select("*");
      if (match) {
        query = query.match(match);
      }
      
      // Para logs de auditoria, vamos ordenar por created_at desc
      if (table === "benefit_audit_logs") {
        query = query.order("created_at", { ascending: false });
      }

      const { data, error } = await query;
      if (error) throw error;
      return NextResponse.json({ data });
    }

    if (action === "insert") {
      const { data, error } = await supabase.from(table).insert(payload).select();
      if (error) throw error;
      return NextResponse.json({ data });
    }

    if (action === "delete") {
      if (!match) throw new Error("Match conditions required for delete");
      const { data, error } = await supabase.from(table).delete().match(match);
      if (error) throw error;
      return NextResponse.json({ data });
    }

    return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
  } catch (error: any) {
    console.error("Proxy error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
