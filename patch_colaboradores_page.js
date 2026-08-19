const fs = require('fs');
let code = fs.readFileSync('src/app/dashboard/colaboradores/page.tsx', 'utf-8');

// 1. Add advanced filters fields
code = code.replace(
  'sector_id: "",',
  'sector_id: "",\n      department_id: "",'
);
code = code.replace(
  'admission_start: "",',
  'admission_start: "",\n      admission_end: "",\n      dismissed_start: "",\n      dismissed_end: "",'
);

// 2. Add birthdayMode state
code = code.replace(
  'const [listPageSize, setListPageSize] = useState(25);',
  'const [listPageSize, setListPageSize] = useState(25);\n  const [birthdayMode, setBirthdayMode] = useState<"atual" | "seguinte">("atual");'
);

// 3. Fetch birthdayMode when mounting
const loadConfigTarget = `    request.then(({ data }) => setStatsRows((data ?? []) as unknown as Employee[]));
  }, [refresh]);`;
// Wait, I am replacing the `statsRows` fetch entirely to make it respect filters!
const newLoadConfig = `    request.then(({ data }) => setStatsRows((data ?? []) as unknown as Employee[]));
    
    // Fetch birthday mode configuration
    supabase.from('system_setting_entries').select('value_text').eq('setting_key', 'colaboradores').eq('path', '{birthday_mode}').maybeSingle().then(({ data }) => {
      if (data && (data.value_text === 'atual' || data.value_text === 'seguinte')) {
        setBirthdayMode(data.value_text);
      }
    });
  }, [refresh]);`;
code = code.replace(loadConfigTarget, newLoadConfig);

// 4. Update the statsRows fetch!
// I need `statsRows` to be refreshed whenever filters change!
// Let's create a separate `useEffect` for `statsRows`?
// Wait, `statsRows` is currently fetched in the first `useEffect` which only depends on `refresh`.
// And the table data is fetched in the SECOND `useEffect` which depends on `[page, pageSize, query, refresh, advancedFilters, activeTab]`.
// I can just move the `statsRows` fetch to the second `useEffect`!

const tableDataEffectStart = '    let request = supabase\n      .from("employees")\n      .select(`${fields}, departments(name), companies(name, trading_name), cost_centers(name:code), workplaces!workplace_id${advancedFilters.unit ? \'!inner\' : \'\'}(name)`, { count: "exact" })';
const newTableDataEffectStart = `    // 1. Fetch paginated table data
    let request = supabase
      .from("employees")
      .select(\`\${fields}, departments(name), companies(name, trading_name), cost_centers(name:code), workplaces!workplace_id\${advancedFilters.unit ? '!inner' : ''}(name)\`, { count: "exact" })`;
code = code.replace(tableDataEffectStart, newTableDataEffectStart);

const queryFilters = `if (advancedFilters.gender) request = request.eq("gender", advancedFilters.gender);
    if (advancedFilters.marital_status) request = request.eq("marital_status", advancedFilters.marital_status);
    if (advancedFilters.sector_id) request = request.eq("sector_id", advancedFilters.sector_id);
    if (advancedFilters.role) request = request.ilike("role", \`%\${advancedFilters.role}%\`);
    if (advancedFilters.unit) request = request.ilike("workplaces.name", \`%\${advancedFilters.unit}%\`);
    if (advancedFilters.admission_start) request = request.gte("admission_date", advancedFilters.admission_start);
    if (advancedFilters.admission_end) request = request.lte("admission_date", advancedFilters.admission_end);`;
const newQueryFilters = `if (advancedFilters.gender) request = request.eq("gender", advancedFilters.gender);
    if (advancedFilters.marital_status) request = request.eq("marital_status", advancedFilters.marital_status);
    if (advancedFilters.sector_id) request = request.eq("sector_id", advancedFilters.sector_id);
    if (advancedFilters.department_id) request = request.eq("department_id", advancedFilters.department_id);
    if (advancedFilters.role) request = request.ilike("role", \`%\${advancedFilters.role}%\`);
    if (advancedFilters.unit) request = request.ilike("workplaces.name", \`%\${advancedFilters.unit}%\`);
    if (advancedFilters.admission_start) request = request.gte("admission_date", advancedFilters.admission_start);
    if (advancedFilters.admission_end) request = request.lte("admission_date", advancedFilters.admission_end);
    if (advancedFilters.dismissed_start) request = request.gte("dismissed_at", advancedFilters.dismissed_start);
    if (advancedFilters.dismissed_end) request = request.lte("dismissed_at", advancedFilters.dismissed_end);`;
code = code.replace(queryFilters, newQueryFilters);

const tableDataEffectEnd = `    const { data, error: loadError, count } = await request;
    setLoading(false);
    if (loadError) {
      setError(\`Não foi possível carregar os colaboradores: \${loadError.message}\`);
    } else {
      setEmployees((data ?? []) as unknown as Employee[]);
    }
    setTotal(count ?? 0);
  }, 250);`;

const newTableDataEffectEnd = `    // 2. Build the unpaginated query for statsRows using the same filters
    let statsRequest = supabase.from("employees").select("status, birthday, admission_date, aso_date, gender, marital_status, sector_id, department_id, role, dismissed_at");
    // Apply same tab logic
    if (activeTab === "inativos") {
      statsRequest = statsRequest.in("status", INACTIVE_STATUSES);
    } else if (advancedFilters.status) {
      statsRequest = statsRequest.eq("status", advancedFilters.status);
    } else {
      statsRequest = HIDDEN_STATUSES.reduce((acc, status) => acc.neq("status", status), statsRequest);
    }
    // Apply same term search
    if (term) statsRequest = statsRequest.or(\`name.ilike."%\${term}%",cpf.ilike."%\${term}%",rg.ilike."%\${term}%",role.ilike."%\${term}%"\`);
    // Apply same advanced filters
    if (advancedFilters.gender) statsRequest = statsRequest.eq("gender", advancedFilters.gender);
    if (advancedFilters.marital_status) statsRequest = statsRequest.eq("marital_status", advancedFilters.marital_status);
    if (advancedFilters.sector_id) statsRequest = statsRequest.eq("sector_id", advancedFilters.sector_id);
    if (advancedFilters.department_id) statsRequest = statsRequest.eq("department_id", advancedFilters.department_id);
    if (advancedFilters.role) statsRequest = statsRequest.ilike("role", \`%\${advancedFilters.role}%\`);
    // Wait, unit is a bit complex since it involves join. For now let's just skip unit in statsRequest since it requires inner join. 
    // Actually, we can just do .select("..., workplaces!inner(name)") and then filter by it. But it's risky. Let's omit unit in stats count for simplicity or try to add it.
    if (advancedFilters.unit) {
      statsRequest = supabase.from("employees").select("status, birthday, admission_date, aso_date, gender, marital_status, sector_id, department_id, role, dismissed_at, workplaces!inner(name)");
      if (activeTab === "inativos") statsRequest = statsRequest.in("status", INACTIVE_STATUSES);
      else if (advancedFilters.status) statsRequest = statsRequest.eq("status", advancedFilters.status);
      else statsRequest = HIDDEN_STATUSES.reduce((acc, status) => acc.neq("status", status), statsRequest);
      if (term) statsRequest = statsRequest.or(\`name.ilike."%\${term}%",cpf.ilike."%\${term}%",rg.ilike."%\${term}%",role.ilike."%\${term}%"\`);
      if (advancedFilters.gender) statsRequest = statsRequest.eq("gender", advancedFilters.gender);
      if (advancedFilters.marital_status) statsRequest = statsRequest.eq("marital_status", advancedFilters.marital_status);
      if (advancedFilters.sector_id) statsRequest = statsRequest.eq("sector_id", advancedFilters.sector_id);
      if (advancedFilters.department_id) statsRequest = statsRequest.eq("department_id", advancedFilters.department_id);
      if (advancedFilters.role) statsRequest = statsRequest.ilike("role", \`%\${advancedFilters.role}%\`);
      statsRequest = statsRequest.ilike("workplaces.name", \`%\${advancedFilters.unit}%\`);
      if (advancedFilters.admission_start) statsRequest = statsRequest.gte("admission_date", advancedFilters.admission_start);
      if (advancedFilters.admission_end) statsRequest = statsRequest.lte("admission_date", advancedFilters.admission_end);
      if (advancedFilters.dismissed_start) statsRequest = statsRequest.gte("dismissed_at", advancedFilters.dismissed_start);
      if (advancedFilters.dismissed_end) statsRequest = statsRequest.lte("dismissed_at", advancedFilters.dismissed_end);
    } else {
      if (advancedFilters.admission_start) statsRequest = statsRequest.gte("admission_date", advancedFilters.admission_start);
      if (advancedFilters.admission_end) statsRequest = statsRequest.lte("admission_date", advancedFilters.admission_end);
      if (advancedFilters.dismissed_start) statsRequest = statsRequest.gte("dismissed_at", advancedFilters.dismissed_start);
      if (advancedFilters.dismissed_end) statsRequest = statsRequest.lte("dismissed_at", advancedFilters.dismissed_end);
    }
    
    // Execute both
    const [pageRes, statsRes] = await Promise.all([request, statsRequest.limit(10000)]);
    
    setLoading(false);
    if (pageRes.error) {
      setError(\`Não foi possível carregar os colaboradores: \${pageRes.error.message}\`);
    } else {
      setEmployees((pageRes.data ?? []) as unknown as Employee[]);
    }
    setTotal(pageRes.count ?? 0);
    setStatsRows((statsRes.data ?? []) as unknown as Employee[]);
  }, 250);`;

code = code.replace(tableDataEffectEnd, newTableDataEffectEnd);

// Remove the old statsRows fetch from the first useEffect
const oldStatsRowsFetch = `const request = HIDDEN_STATUSES.reduce(
      (acc, status) => acc.neq("status", status),
      supabase.from("employees").select("status, birthday, admission_date, aso_date").limit(10000)
    );
    request.then(({ data }) => setStatsRows((data ?? []) as unknown as Employee[]));`;
code = code.replace(oldStatsRowsFetch, '');

// Update StatsCards props
code = code.replace('<StatsCards employees={statsRows} />', '<StatsCards employees={statsRows} birthdayMode={birthdayMode} />');

// Update UI to show the new filters!
// I need to find the "Filtros Avançados" modal
// In `colaboradores/page.tsx`
const modalFiltersTarget = `<div className="space-y-1">
                <Label>Setor</Label>
                <Select value={advancedFilters.sector_id} onChange={(e) => setAdvancedFilters({...advancedFilters, sector_id: e.target.value})}>
                  <option value="">Todos</option>
                  {sectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </Select>
              </div>`;
const newModalFilters = `<div className="space-y-1">
                <Label>Departamento</Label>
                <Select value={advancedFilters.department_id} onChange={(e) => setAdvancedFilters({...advancedFilters, department_id: e.target.value})}>
                  <option value="">Todos</option>
                  {departments.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Setor</Label>
                <Select value={advancedFilters.sector_id} onChange={(e) => setAdvancedFilters({...advancedFilters, sector_id: e.target.value})}>
                  <option value="">Todos</option>
                  {sectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </Select>
              </div>`;
code = code.replace(modalFiltersTarget, newModalFilters);

const datesTarget = `<div className="space-y-1">
                <Label>Admissão Até</Label>
                <Input type="date" value={advancedFilters.admission_end} onChange={(e) => setAdvancedFilters({...advancedFilters, admission_end: e.target.value})} />
              </div>`;
const newDates = `<div className="space-y-1">
                <Label>Admissão Até</Label>
                <Input type="date" value={advancedFilters.admission_end} onChange={(e) => setAdvancedFilters({...advancedFilters, admission_end: e.target.value})} />
              </div>
              <div className="space-y-1">
                <Label>Desligamento De</Label>
                <Input type="date" value={advancedFilters.dismissed_start} onChange={(e) => setAdvancedFilters({...advancedFilters, dismissed_start: e.target.value})} />
              </div>
              <div className="space-y-1">
                <Label>Desligamento Até</Label>
                <Input type="date" value={advancedFilters.dismissed_end} onChange={(e) => setAdvancedFilters({...advancedFilters, dismissed_end: e.target.value})} />
              </div>`;
code = code.replace(datesTarget, newDates);

fs.writeFileSync('src/app/dashboard/colaboradores/page.tsx', code);
