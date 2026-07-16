const fs = require('fs');
const path = require('path');

const file = path.join('src', 'app', 'dashboard', 'colaboradores', 'page.tsx');
let content = fs.readFileSync(file, 'utf8');

// 1. type Entity
content = content.replace(
  /type Department = { id: string; name: string };/,
  `type Department = { id: string; name: string };\ntype Entity = { id: string; name: string };`
);

// 2. Employee type
content = content.replace(
  /type Employee = Record<string, string \| null \| Department> & { id: string; name: string; departments: Department \| null; level\?: string \| null };/,
  `type Employee = Record<string, string | null | any> & { id: string; name: string; departments?: Entity | null; level?: string | null; companies?: Entity | null; cost_centers?: Entity | null; workplaces?: Entity | null; };`
);

// 3. fields
content = content.replace(
  /"id", "name", "department_id", "birthday", "status", "dismissed_at", "role", "phone",\s*"email_personal", "email_corporate", "contract_type", "admission_date", "shirt_size", "gender",\s*"unit", "cpf", "rg", "ctps", "ctps_serie", "pis", "marital_status", "cost_center", "cbo",\s*"aso_date", "observation", "workplace", "level"/,
  `"id", "name", "department_id", "birthday", "status", "dismissed_at", "role", "phone", "email_personal", "email_corporate", "contract_type", "admission_date", "shirt_size", "gender", "cpf", "rg", "ctps", "ctps_serie", "pis", "marital_status", "cbo", "aso_date", "observation", "level", "company_id", "cost_center_id", "workplace_id"`
);

// 4. emptyForm
content = content.replace(
  /const emptyForm = {\s*name: "", department_id: "", birthday: "", status: "Ativo", dismissed_at: "", role: "", level: "", phone: "",\s*email_personal: "", email_corporate: "", contract_type: "", admission_date: "", shirt_size: "",\s*gender: "", unit: "", cpf: "", rg: "", ctps: "", ctps_serie: "", pis: "", marital_status: "",\s*cost_center: "", cbo: "", aso_date: "", observation: "", workplace: "",\s*};/,
  `const emptyForm = {\n  name: "", department_id: "", birthday: "", status: "Ativo", dismissed_at: "", role: "", level: "", phone: "",\n  email_personal: "", email_corporate: "", contract_type: "", admission_date: "", shirt_size: "",\n  gender: "", cpf: "", rg: "", ctps: "", ctps_serie: "", pis: "", marital_status: "",\n  cbo: "", aso_date: "", observation: "", company_id: "", cost_center_id: "", workplace_id: ""\n};`
);

// 5. useState arrays
content = content.replace(
  /const \[departments, setDepartments\] = useState<Department\[\]>\(\[\]\);/,
  `const [departments, setDepartments] = useState<Entity[]>([]);\n  const [companies, setCompanies] = useState<Entity[]>([]);\n  const [costCenters, setCostCenters] = useState<Entity[]>([]);\n  const [workplaces, setWorkplaces] = useState<Entity[]>([]);`
);

// 6. useEffect fetch
content = content.replace(
  /supabase\.from\("departments"\)\.select\("id, name"\)\.order\("name"\)\.then\(\(\{ data \}\) => setDepartments\(\(data \?\? \[\]\) as Department\[\]\)\);/,
  `supabase.from("departments").select("id, name").order("name").then(({ data }) => setDepartments((data ?? []) as Entity[]));\n    supabase.from("companies").select("id, name").order("name").then(({ data }) => setCompanies((data ?? []) as Entity[]));\n    supabase.from("cost_centers").select("id, name").order("name").then(({ data }) => setCostCenters((data ?? []) as Entity[]));\n    supabase.from("workplaces").select("id, name").order("name").then(({ data }) => setWorkplaces((data ?? []) as Entity[]));`
);

// 7. select fields request
content = content.replace(
  /select\(\`\$\{fields\}, departments\(name\)\`, { count: "exact" }\)/,
  `select(\`\${fields}, departments(name), companies(name), cost_centers(name), workplaces(name)\`, { count: "exact" })`
);

// 8. payload in save()
content = content.replace(
  /const nullableDates = new Set\(\["birthday", "dismissed_at", "admission_date", "aso_date"\]\);\s*const payload = Object\.fromEntries\(Object\.entries\(form\)\.map\(\(\[key, value\]\) => \[key, nullableDates\.has\(key\) \|\| key === "department_id" \? value \|\| null : value\.trim\(\) \|\| null\]\)\);/,
  `const nullableDates = new Set(["birthday", "dismissed_at", "admission_date", "aso_date"]);\n    const nullableUuids = new Set(["department_id", "company_id", "cost_center_id", "workplace_id"]);\n    const payload = Object.fromEntries(Object.entries(form).map(([key, value]) => [key, nullableDates.has(key) || nullableUuids.has(key) ? value || null : (value as string).trim() || null]));`
);

// 9. isPromoted
content = content.replace(
  /form\.workplace !== original\?\.workplace/,
  `form.workplace_id !== original?.workplace_id`
);

// 9b. isPromoted RGS payload
content = content.replace(
  /location: payload\.workplace,/,
  `location: payload.workplace_id ? workplaces.find(w => w.id === payload.workplace_id)?.name || null : null,`
);

// 10. <Section title="Vínculo e lotação"> UI
content = content.replace(
  /<Field label="Departamento"><select value={form\.department_id} onChange={\(e\) => update\("department_id", e\.target\.value\)} className="h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="">Não informado<\/option>{departments\.map\(\(department\) => <option key={department\.id} value={department\.id}>{department\.name}<\/option>\)}<\/select><\/Field>\s*<Field label="Tipo de contrato"><Input value={form\.contract_type} onChange={\(e\) => update\("contract_type", e\.target\.value\)} \/><\/Field>\s*<Field label="Data de admissão"><Input type="date" value={form\.admission_date} onChange={\(e\) => update\("admission_date", e\.target\.value\)} \/><\/Field>\s*<Field label="Data de desligamento"><Input type="date" value={form\.dismissed_at} onChange={\(e\) => update\("dismissed_at", e\.target\.value\)} \/><\/Field>\s*<Field label="Unidade \/ obra"><Input value={form\.unit} onChange={\(e\) => update\("unit", e\.target\.value\)} \/><\/Field>\s*<Field label="Local de trabalho"><Input value={form\.workplace} onChange={\(e\) => update\("workplace", e\.target\.value\)} \/><\/Field>\s*<Field label="Centro de custo"><Input value={form\.cost_center} onChange={\(e\) => update\("cost_center", e\.target\.value\)} \/><\/Field>/,
  `<Field label="Empresa *"><select value={form.company_id} onChange={(e) => update("company_id", e.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm" required><option value="">Selecione...</option>{companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
              <Field label="Centro de Custo *"><select value={form.cost_center_id} onChange={(e) => update("cost_center_id", e.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm" required><option value="">Selecione...</option>{costCenters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
              <Field label="Obra/Unidade"><select value={form.workplace_id} onChange={(e) => update("workplace_id", e.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="">Não informado</option>{workplaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select></Field>
              <Field label="Departamento"><select value={form.department_id} onChange={(e) => update("department_id", e.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="">Não informado</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>
              <Field label="Tipo de contrato"><Input value={form.contract_type} onChange={(e) => update("contract_type", e.target.value)} /></Field>
              <Field label="Data de admissão"><Input type="date" value={form.admission_date} onChange={(e) => update("admission_date", e.target.value)} /></Field>
              <Field label="Data de desligamento"><Input type="date" value={form.dismissed_at} onChange={(e) => update("dismissed_at", e.target.value)} /></Field>`
);

// 11. table display
content = content.replace(
  /<div className="text-xs text-muted-foreground">{employee\.departments\?\.name \?\? String\(employee\.unit \?\? employee\.workplace \?\? "-"\)}<\/div>/,
  `<div className="text-xs text-muted-foreground">
                        {employee.companies?.name ? \`\${employee.companies.name}\` : ""}
                        {employee.workplaces?.name ? \` · \${employee.workplaces.name}\` : ""}
                        {employee.departments?.name ? \` · \${employee.departments.name}\` : ""}
                        {(!employee.companies?.name && !employee.workplaces?.name && !employee.departments?.name) && "-"}
                      </div>`
);

// 12. exportBirthdaysCsv logic
content = content.replace(
  /\`"\\\${e\.departments\?\.name \|\| e\.unit \|\| e\.workplace \|\| ''}"\`/,
  `\`"\${e.departments?.name || e.workplaces?.name || ''}"\``
);


fs.writeFileSync(file, content);
console.log('Done!');
