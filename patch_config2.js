const fs = require('fs');
let code = fs.readFileSync('src/app/dashboard/configuracoes/page.tsx', 'utf-8');

// 1. Add state
code = code.replace(
  'const [reminderDay, setReminderDay] = useState<number>(15);',
  'const [reminderDay, setReminderDay] = useState<number>(15);\n  const [birthdayMode, setBirthdayMode] = useState<"atual" | "seguinte">("atual");'
);

// 2. Load
code = code.replace(
  ".in('key', ['modules', 'permissions', 'work_schedules', 'monthly_benefits'])",
  ".in('key', ['modules', 'permissions', 'work_schedules', 'monthly_benefits', 'colaboradores'])"
);

code = code.replace(
  "if (row.key === 'work_schedules')",
  "if (row.key === 'colaboradores') {\n              const entry = entries.find(e => e.path[0] === 'birthday_mode');\n              if (entry && (entry.value_text === 'atual' || entry.value_text === 'seguinte')) setBirthdayMode(entry.value_text);\n            }\n            if (row.key === 'work_schedules')"
);

// 3. Save
code = code.replace(
  "{ key: 'monthly_benefits', pause_history_tracking: false }",
  "{ key: 'monthly_benefits', pause_history_tracking: false },\n          { key: 'colaboradores', pause_history_tracking: false }"
);

code = code.replace(
  ".in('setting_key', ['modules', 'permissions', 'work_schedules', 'monthly_benefits']);",
  ".in('setting_key', ['modules', 'permissions', 'work_schedules', 'monthly_benefits', 'colaboradores']);"
);

code = code.replace(
  "{ setting_key: 'monthly_benefits', path: ['reminder_day'], value_type: 'string', value_text: String(reminderDay) },",
  "{ setting_key: 'monthly_benefits', path: ['reminder_day'], value_type: 'string', value_text: String(reminderDay) },\n          { setting_key: 'colaboradores', path: ['birthday_mode'], value_type: 'string', value_text: birthdayMode },"
);

// 4. UI
const uiTarget = '</TabsContent>\n\n        <TabsContent value="permissoes" className="mt-6 space-y-6">';
const newUi = `            <Card className="border-border/60 shadow-sm mt-6">
              <CardHeader className="pb-4 border-b border-border/40 mb-4">
                <CardTitle className="text-lg">Configurações de Colaboradores</CardTitle>
                <CardDescription>Defina as preferências para exibição e cálculo de indicadores.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base font-medium">Contador de Comemorações</Label>
                    <p className="text-sm text-muted-foreground">Mês de referência para aniversários de vida e tempo de casa.</p>
                  </div>
                  <select 
                    value={birthdayMode} 
                    onChange={(e) => setBirthdayMode(e.target.value as "atual" | "seguinte")}
                    className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="atual">Mês Atual</option>
                    <option value="seguinte">Mês Seguinte</option>
                  </select>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

        <TabsContent value="permissoes" className="mt-6 space-y-6">`;

code = code.replace(uiTarget, newUi);

fs.writeFileSync('src/app/dashboard/configuracoes/page.tsx', code);
