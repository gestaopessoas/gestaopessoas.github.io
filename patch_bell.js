const fs = require('fs');
let code = fs.readFileSync('src/components/layout/NotificationBell.tsx', 'utf-8');

// 1. Add MonthlyBenefitNotification to imports
code = code.replace(
  'BenefitNotification,',
  'BenefitNotification,\n  MonthlyBenefitNotification,'
);
code = code.replace(
  'generateBenefitNotifications\n',
  'generateBenefitNotifications,\n  generateMonthlyBenefitNotifications\n'
);

// 2. Add state
code = code.replace(
  'const [benefitNotifications, setBenefitNotifications] = useState<BenefitNotification[]>([]);',
  'const [benefitNotifications, setBenefitNotifications] = useState<BenefitNotification[]>([]);\n  const [monthlyBenefitNotifications, setMonthlyBenefitNotifications] = useState<MonthlyBenefitNotification[]>([]);'
);

// 3. Fetch monthly benefits logic
const fetchLogicTarget = '        supabase.from("partner_leads").select("id").neq("status", "atendido")\n      ]);';
const newFetchLogic = `        supabase.from("partner_leads").select("id").neq("status", "atendido"),
        supabase.from("system_setting_entries").select("value_text").eq("setting_key", "monthly_benefits").eq("path", "{reminder_day}").maybeSingle(),
        supabase.from("employee_monthly_benefits").select("employee_id, benefit_name, reference_month")
      ]);`;
code = code.replace(fetchLogicTarget, newFetchLogic);

// Wait, the indices for Promises:
// 0: employees
// 1: rgs_processes
// 2: employee_benefits
// 3: benefit_ignores
// 4: partner_leads
// 5: reminderDay
// 6: monthly_benefits

const destructTarget = 'const [empRes, rgsRes, bensRes, igsRes, leadsRes] = await Promise.all([';
const newDestruct = 'const [empRes, rgsRes, bensRes, igsRes, leadsRes, reminderRes, monthlyRes] = await Promise.all([';
code = code.replace(destructTarget, newDestruct);

// In the data extraction:
// let leads = leadsRes.data || [];
const setNotificationsTarget = 'setBenefitNotifications(generateBenefitNotifications(empData, (bens ?? []) as unknown as BenefitData[], userPrefs, ignoredIds));';
const newSetNotifications = `setBenefitNotifications(generateBenefitNotifications(empData, (bens ?? []) as unknown as BenefitData[], userPrefs, ignoredIds));
        
        const referenceMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
        const reminderDay = reminderRes?.data?.value_text ? Number(reminderRes.data.value_text) : 15;
        const monthlyNotes = generateMonthlyBenefitNotifications(
          empData,
          bens as any,
          (monthlyRes?.data ?? []) as any,
          referenceMonth,
          reminderDay
        );
        setMonthlyBenefitNotifications(monthlyNotes);`;
code = code.replace(setNotificationsTarget, newSetNotifications);

// Total count
const countTarget = 'const totalCount = trialNotifications.length + rgsNotifications.length + benefitNotifications.length + pendingProfiles.length + pendingLeads;';
const newCount = 'const totalCount = trialNotifications.length + rgsNotifications.length + benefitNotifications.length + monthlyBenefitNotifications.length + pendingProfiles.length + pendingLeads;';
code = code.replace(countTarget, newCount);

// UI Dropdown
const uiTarget = '{/* Benefícios */}';
const newUi = `{/* Lançamentos Mensais */}
              {monthlyBenefitNotifications.length > 0 && (
                <div className="border-b last:border-b-0 pb-2">
                  <div className="sticky top-0 bg-muted/80 backdrop-blur-sm px-3 py-2 flex items-center justify-between z-10 border-b">
                    <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <DollarSign className="h-3.5 w-3.5 text-amber-500" /> Benefícios Mensais
                    </h3>
                    <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{monthlyBenefitNotifications.length}</span>
                  </div>
                  <div className="px-2 pt-2 flex flex-col gap-1">
                    {monthlyBenefitNotifications.map((n) => (
                      <div key={n.id} className="text-sm p-2 bg-muted/30 rounded-md hover:bg-muted/50 cursor-pointer transition-colors" onClick={() => { setIsOpen(false); router.push("/dashboard/beneficios"); }}>
                        <div className="font-medium text-foreground">{n.name}</div>
                        <div className="text-xs text-muted-foreground">Pendente: {n.benefits.join(", ")}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Benefícios */}`;
code = code.replace(uiTarget, newUi);

code = code.replace('HeartPulse,', 'HeartPulse, DollarSign,');

fs.writeFileSync('src/components/layout/NotificationBell.tsx', code);
