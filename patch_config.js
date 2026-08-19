const fs = require('fs');
let code = fs.readFileSync('src/app/dashboard/configuracoes/page.tsx', 'utf-8');

// 1. Add state
code = code.replace(
  'const [workSchedules, setWorkSchedules] = useState<string[]>([',
  'const [reminderDay, setReminderDay] = useState<number>(15);\n  const [workSchedules, setWorkSchedules] = useState<string[]>(['
);

// 2. Load reminderDay
code = code.replace(
  ".in('key', ['modules', 'permissions', 'work_schedules'])",
  ".in('key', ['modules', 'permissions', 'work_schedules', 'monthly_benefits'])"
);
code = code.replace(
  "if (row.key === 'work_schedules') setWorkSchedules(entries.sort((a, b) => Number(a.path[0]) - Number(b.path[0])).map((entry) => entry.value_text ?? ''))",
  "if (row.key === 'work_schedules') setWorkSchedules(entries.sort((a, b) => Number(a.path[0]) - Number(b.path[0])).map((entry) => entry.value_text ?? ''))\n          if (row.key === 'monthly_benefits') {\n            const entry = entries.find(e => e.path[0] === 'reminder_day');\n            if (entry) setReminderDay(Number(entry.value_text));\n          }"
);

// 3. Save reminderDay
code = code.replace(
  "{ key: 'work_schedules', pause_history_tracking: pauseHistory }",
  "{ key: 'work_schedules', pause_history_tracking: pauseHistory },\n        { key: 'monthly_benefits', pause_history_tracking: false }"
);

code = code.replace(
  ".in('setting_key', ['modules', 'permissions', 'work_schedules']);",
  ".in('setting_key', ['modules', 'permissions', 'work_schedules', 'monthly_benefits']);"
);

code = code.replace(
  "...workSchedules.map((value, index) => ({ setting_key: 'work_schedules', path: [String(index)], value_type: 'string', value_text: value })),",
  "...workSchedules.map((value, index) => ({ setting_key: 'work_schedules', path: [String(index)], value_type: 'string', value_text: value })),\n        { setting_key: 'monthly_benefits', path: ['reminder_day'], value_type: 'string', value_text: String(reminderDay) },"
);

// 4. Add UI Card
const uiTarget = '</TabsContent>\n\n        <TabsContent value="permissoes" className="mt-6 space-y-6">';
const newUi = `            <Card className="border-border/60 shadow-sm mt-6">
              <CardHeader className="pb-4 border-b border-border/40 mb-4">
                <CardTitle className="text-lg">Benefícios & Notificações</CardTitle>
                <CardDescription>Configure alertas para preenchimento de variáveis e comissões.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base font-medium">Dia de Notificação Mensal</Label>
                    <p className="text-sm text-muted-foreground">Dia do mês para alertar sobre pendências (1 a 31).</p>
                  </div>
                  <Input type="number" min={1} max={31} value={reminderDay} onChange={(e) => setReminderDay(Number(e.target.value))} className="w-24 text-center" />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

        <TabsContent value="permissoes" className="mt-6 space-y-6">`;

code = code.replace(uiTarget, newUi);

fs.writeFileSync('src/app/dashboard/configuracoes/page.tsx', code);
