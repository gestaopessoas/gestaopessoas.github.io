const fs = require('fs');
let code = fs.readFileSync('src/app/dashboard/colaboradores/page.tsx', 'utf-8');

// 1. Add imports
code = code.replace(
  'import { CandidateProfileModal } from "@/components/CandidateProfileModal";',
  'import { CandidateProfileModal } from "@/components/CandidateProfileModal";\nimport { findCode } from "@/lib/codeLookup";\nimport cboData from "@/data/cbo.json";'
);

// 2. Add handleCodeLookup
const updateStr = '  const update = (field: keyof EmployeeForm, value: string) => setForm((current) => {';
const handleCodeStr = `
  const handleCodeLookup = (e: React.KeyboardEvent<HTMLInputElement>, field: "profile_code" | "cbo") => {
    if (e.ctrlKey && e.key === "Enter") {
      e.preventDefault();
      const queryStr = form[field] || form.role;
      if (!queryStr) return;
      
      const source = field === "profile_code" ? jobProfiles : cboData;
      const type = field === "profile_code" ? "cargo" : "cbo";
      const result = findCode(queryStr, type, source);
      
      if (result.code) {
        update(field, result.code);
      } else if (result.matches.length > 0) {
        const msg = result.matches.map((m, i) => \`\${i + 1} - \${m.title} (\${m.code})\`).join('\\n');
        const ans = window.prompt(\`Múltiplos encontrados. Digite o número da opção:\\n\${msg}\`);
        if (ans) {
          const idx = parseInt(ans) - 1;
          if (idx >= 0 && idx < result.matches.length) {
            update(field, result.matches[idx].code);
          }
        }
      } else {
        alert("Nenhum código encontrado.");
      }
    }
  };

`;

code = code.replace(updateStr, handleCodeStr + updateStr);

// 3. Add onKeyDown to fields
code = code.replace(
  '<Field label="CBO"><Input value={form.cbo} onChange={(e) => update("cbo", e.target.value)} /></Field>',
  '<Field label="CBO"><Input value={form.cbo} onChange={(e) => update("cbo", e.target.value)} onKeyDown={(e) => handleCodeLookup(e, "cbo")} placeholder="Ctrl+Enter para buscar" /></Field>'
);

code = code.replace(
  '<Field label="Código do Perfil"><Input value={form.profile_code} onChange={(e) => update("profile_code", e.target.value)} /></Field>',
  '<Field label="Código do Perfil"><Input value={form.profile_code} onChange={(e) => update("profile_code", e.target.value)} onKeyDown={(e) => handleCodeLookup(e, "profile_code")} placeholder="Ctrl+Enter para buscar" /></Field>'
);

fs.writeFileSync('src/app/dashboard/colaboradores/page.tsx', code);
