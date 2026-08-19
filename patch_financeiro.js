const fs = require('fs');
let code = fs.readFileSync('src/app/dashboard/financeiro/page.tsx', 'utf-8');

const importStr = 'import { createClient } from "@/utils/supabase/client";';
const newImport = 'import { createClient } from "@/utils/supabase/client";\nimport { calculateFinancialCosts, type EmployeeBenefitStatus } from "./lib/financialCosts";\nimport { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";\nimport { DollarSign } from "lucide-react";';

code = code.replace(importStr, newImport);

// Add states
const stateStr = '  const [status, setStatus] = useState<string>("Em Andamento");';
const newStateStr = `  const [status, setStatus] = useState<string>("Em Andamento");
  const [seguroUnitCost, setSeguroUnitCost] = useState<number>(15);
  const [almocoUnitCost, setAlmocoUnitCost] = useState<number>(25);
  const [benefitStats, setBenefitStats] = useState({ seguroTotal: 0, almocoTotal: 0, seguroCount: 0, almocoCount: 0 });`;

code = code.replace(stateStr, newStateStr);

// In loadData, fetch eligible employees
const loadDataEndStr = '      setLoading(false);\n    };';
const newLoadDataEndStr = `        // Fetch benefits for summary card
        const { data: activeBenefits } = await supabase
          .from("employee_benefits")
          .select("employee_id, benefit_name")
          .in("benefit_name", ["Seguro de Vida", "Almoço"])
          .eq("active", true);
        
        const { data: emps } = await supabase.from("employees").select("id, name, status, dismissed_at");
        
        if (activeBenefits && emps) {
          const mapped: EmployeeBenefitStatus[] = emps.map(e => ({
            id: e.id,
            name: e.name,
            status: e.status,
            dismissed_at: e.dismissed_at,
            hasSeguroVida: activeBenefits.some(b => b.employee_id === e.id && b.benefit_name === "Seguro de Vida"),
            hasAlmoco: activeBenefits.some(b => b.employee_id === e.id && b.benefit_name === "Almoço")
          }));
          const stats = calculateFinancialCosts(mapped, seguroUnitCost, almocoUnitCost);
          setBenefitStats(stats);
        }
      }
      setLoading(false);
    };`;

code = code.replace(`      }
      setLoading(false);
    };`, newLoadDataEndStr);

// Recalculate if unit cost changes
const effectStr = `  useEffect(() => {
    loadData();
  }, [month, year]);`;
const newEffectStr = `  useEffect(() => {
    loadData();
  }, [month, year, seguroUnitCost, almocoUnitCost]);`;
code = code.replace(effectStr, newEffectStr);

// Add UI Card above the table
const uiTargetStr = '      <div className="overflow-x-auto rounded-lg border bg-card">';
const newUiStr = `      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" /> 
              Custo: Seguro de Vida
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(benefitStats.seguroTotal)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {benefitStats.seguroCount} elegíveis × <input type="number" className="w-16 h-6 border rounded px-1 text-right inline-block ml-1" value={seguroUnitCost} onChange={(e) => setSeguroUnitCost(Number(e.target.value))} /> /cada
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" /> 
              Custo: Almoço na Empresa
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(benefitStats.almocoTotal)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {benefitStats.almocoCount} elegíveis × <input type="number" className="w-16 h-6 border rounded px-1 text-right inline-block ml-1" value={almocoUnitCost} onChange={(e) => setAlmocoUnitCost(Number(e.target.value))} /> /cada
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-card">`;
code = code.replace(uiTargetStr, newUiStr);

// Fix total calculation to include these new dynamic values!
const totalsStr = `    acc.seguro += Number(curr.seguro || 0);`;
const newTotalsStr = `    acc.seguro += Number(curr.seguro || 0);`;
// Wait, do they want to REPLACE the table total? "Conferir total geral da aba financeira soma corretamente os dois novos itens."
const totalTargetStr = `    acc.total += Number(curr.total || 0);`;
// Let's modify the total in the bottom row?
// No, the total in the bottom row is `formatCurrency(totals.total)`
// Wait, if I add it to `totals.total`, then `formatCurrency(totals.total + benefitStats.seguroTotal + benefitStats.almocoTotal)`!
const uiTotalStr = `<td className="p-3 text-right text-lg text-primary">{formatCurrency(totals.total)}</td>`;
const newUiTotalStr = `<td className="p-3 text-right text-lg text-primary">{formatCurrency(totals.total + benefitStats.seguroTotal + benefitStats.almocoTotal)}</td>`;
code = code.replace(uiTotalStr, newUiTotalStr);

fs.writeFileSync('src/app/dashboard/financeiro/page.tsx', code);
