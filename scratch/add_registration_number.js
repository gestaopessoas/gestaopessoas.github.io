const fs = require('fs');
const path = require('path');

const file = path.join('src', 'app', 'dashboard', 'colaboradores', 'page.tsx');
let content = fs.readFileSync(file, 'utf8');

// 1. Add registration_number to fields
content = content.replace(
  /"id", "name", "department_id", "birthday", "status", "dismissed_at", "role", "phone", "email_personal", "email_corporate", "contract_type", "admission_date", "shirt_size", "gender", "cpf", "rg", "ctps", "ctps_serie", "pis", "marital_status", "cbo", "aso_date", "observation", "level", "company_id", "cost_center_id", "workplace_id"/,
  `"id", "name", "registration_number", "department_id", "birthday", "status", "dismissed_at", "role", "phone", "email_personal", "email_corporate", "contract_type", "admission_date", "shirt_size", "gender", "cpf", "rg", "ctps", "ctps_serie", "pis", "marital_status", "cbo", "aso_date", "observation", "level", "company_id", "cost_center_id", "workplace_id"`
);

// 2. Add registration_number to emptyForm
content = content.replace(
  /const emptyForm = \{\s*name: "", department_id: "", birthday: "", status: "Ativo", dismissed_at: "", role: "", level: "", phone: "",/,
  `const emptyForm = {\n  name: "", registration_number: "", department_id: "", birthday: "", status: "Ativo", dismissed_at: "", role: "", level: "", phone: "",`
);

// 3. Add to UI form
content = content.replace(
  /<Field label="Nome da mãe"><Input value={form.mother_name} onChange={\(e\) => update\("mother_name", e\.target\.value\)} \/><\/Field>/, // Wait, is there mother_name? No.
  `` // Just a placeholder
);

// Actually, I'll use regex to insert the registration_number input in "Informações Pessoais" or "Vínculo e lotação"
// Let's put it in the "Dados Pessoais" section right after name or CPF.
// Or in "Vínculo e lotação" right after Status or Nível.
content = content.replace(
  /<Field label="Nome completo \*"><Input value={form\.name} onChange={\(e\) => update\("name", e\.target\.value\)} required \/><\/Field>/,
  `<Field label="Nome completo *"><Input value={form.name} onChange={(e) => update("name", e.target.value)} required /></Field>
              <Field label="Matrícula"><Input value={form.registration_number} onChange={(e) => update("registration_number", e.target.value)} /></Field>`
);

// 4. Update the table display to show registration_number
content = content.replace(
  /<td className="p-3 font-medium">\{employee\.name\}<\/td>/,
  `<td className="p-3 font-medium"><div>{employee.name}</div>{employee.registration_number && <div className="text-xs text-muted-foreground font-normal">Matrícula: {employee.registration_number}</div>}</td>`
);


fs.writeFileSync(file, content);
console.log('Done!');
