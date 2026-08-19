const fs = require('fs');
let code = fs.readFileSync('src/app/dashboard/cargos/page.tsx', 'utf-8');

// 1. Add imports
code = code.replace(
  '"use client";',
  '"use client";\nimport { findCode } from "@/lib/codeLookup";\nimport cboData from "@/data/cbo.json";'
);

// 2. Add handleCboLookup before startNew (just inside the component)
const insertTarget = '  const startNew = () => {';
const handleCodeStr = `
  const handleCboLookup = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.ctrlKey && e.key === "Enter") {
      e.preventDefault();
      const queryStr = form.cbo || form.title;
      if (!queryStr) return;
      
      const result = findCode(queryStr, "cbo", cboData);
      
      if (result.code) {
        setForm({ ...form, cbo: result.code });
      } else if (result.matches.length > 0) {
        const msg = result.matches.map((m, i) => \`\${i + 1} - \${m.title} (\${m.code})\`).join('\\n');
        const ans = window.prompt(\`Múltiplos encontrados. Digite o número da opção:\\n\${msg}\`);
        if (ans) {
          const idx = parseInt(ans) - 1;
          if (idx >= 0 && idx < result.matches.length) {
            setForm({ ...form, cbo: result.matches[idx].code });
          }
        }
      } else {
        alert("Nenhum código encontrado.");
      }
    }
  };

`;

code = code.replace(insertTarget, handleCodeStr + insertTarget);

// 3. Add onKeyDown to CBO
code = code.replace(
  '<Field label="CBO"><Input value={form.cbo} onChange={(event) => setForm({ ...form, cbo: event.target.value })} /></Field>',
  '<Field label="CBO"><Input value={form.cbo} onChange={(event) => setForm({ ...form, cbo: event.target.value })} onKeyDown={handleCboLookup} placeholder="Ctrl+Enter p/ buscar" /></Field>'
);

fs.writeFileSync('src/app/dashboard/cargos/page.tsx', code);
