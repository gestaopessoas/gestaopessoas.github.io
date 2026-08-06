export interface EmployeeRecord {
  id: string;
  name: string;
  registration_number: string | null;
  company_id: string | null;
  workplace_id: string | null;
  unit: string | null;
  work_schedule_start_1?: string | null;
  work_schedule_end_1?: string | null;
  work_schedule_start_2?: string | null;
  work_schedule_end_2?: string | null;
  status?: string | null;
}

export interface CompanyRecord {
  id: string;
  name: string;
  trading_name?: string | null;
  dominio_code?: string | null;
}

export interface WorkplaceRecord {
  id: string;
  name: string;
  type?: string | null;
}

export interface AlertItem {
  rawMatricula: string;
  lineNumber: number;
  reason: string;
  employeeName?: string;
}

export interface ScheduleSuggestion {
  type: 'SEDE_PLANTAO' | 'OBRA' | 'GERAL';
  start1: string;
  end1: string;
  start2: string;
  end2: string;
  display: string;
}

export interface MatchedEmployeeSummary {
  employeeId: string;
  name: string;
  registrationNumber: string;
  companyName: string;
  workplaceName: string;
  recordsCount: number;
  schedule: ScheduleSuggestion;
  needsScheduleUpdate: boolean;
}

export interface CompanyOutputFile {
  companyId: string;
  companyName: string;
  dominioCode: string;
  fileName: string;
  recordsCount: number;
  content: string;
  employees: MatchedEmployeeSummary[];
}

export interface ProcessedRhidResult {
  fileName: string;
  totalLines: number;
  validRecordsCount: number;
  filesByCompany: CompanyOutputFile[];
  alerts: AlertItem[];
  matchedEmployeesList: MatchedEmployeeSummary[];
}

export const getStandardSchedule = (emp: EmployeeRecord, workplaces: WorkplaceRecord[]): ScheduleSuggestion => {
  let isSedeOrPlantão = emp.unit === 'Sede' || emp.unit === 'Plantão';
  let isObra = emp.unit === 'Obra';
  
  if (emp.workplace_id) {
    const wp = workplaces.find(w => w.id === emp.workplace_id);
    if (wp && wp.type) {
      const typeUpper = wp.type.toUpperCase();
      if (typeUpper === 'SEDE' || typeUpper === 'PLANTÃO DE VENDAS' || typeUpper.includes('PLANTÃO') || typeUpper.includes('PLANTAO')) {
        isSedeOrPlantão = true;
        isObra = false;
      } else if (typeUpper === 'OBRA') {
        isObra = true;
        isSedeOrPlantão = false;
      }
    }
  }

  if (isSedeOrPlantão) {
    return {
      type: 'SEDE_PLANTAO',
      start1: '07:45:00',
      end1: '12:00:00',
      start2: '13:15:00',
      end2: '17:48:00',
      display: '07:45 - 12:00 / 13:15 - 17:48 (Sede/Plantão)'
    };
  } else if (isObra) {
    return {
      type: 'OBRA',
      start1: '07:30:00',
      end1: '12:00:00',
      start2: '13:15:00',
      end2: '17:33:00',
      display: '07:30 - 12:00 / 13:15 - 17:33 (Obra)'
    };
  } else {
    const start1 = emp.work_schedule_start_1 || '07:45:00';
    const end1 = emp.work_schedule_end_1 || '12:00:00';
    const start2 = emp.work_schedule_start_2 || '13:15:00';
    const end2 = emp.work_schedule_end_2 || '17:48:00';
    return {
      type: 'GERAL',
      start1,
      end1,
      start2,
      end2,
      display: `${start1.slice(0,5)} - ${end1.slice(0,5)} / ${start2.slice(0,5)} - ${end2.slice(0,5)} (Mantido)`
    };
  }
};

const matchEmployee = (rawMatricula: string, employees: EmployeeRecord[]): EmployeeRecord | undefined => {
  const cleanMatricula = rawMatricula.trim();
  if (!cleanMatricula || cleanMatricula === "00000" || cleanMatricula === "0000") return undefined;
  
  const numMatricula = parseInt(cleanMatricula, 10);

  return employees.find(emp => {
    if (!emp.registration_number) return false;
    const empReg = emp.registration_number.trim();
    if (empReg === cleanMatricula) return true;
    const empNum = parseInt(empReg, 10);
    return !isNaN(numMatricula) && !isNaN(empNum) && empNum === numMatricula;
  });
};

const formatDomainCode = (code?: string | null): string => {
  const cleanCode = (code || "1").trim().replace(/[^0-9]/g, "");
  const finalCode = cleanCode || "1";
  return finalCode.padStart(10, "0");
};

const formatCompanyNameForFile = (name: string): string => {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_ -]/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .toUpperCase();
};

export const processRhidTxt = (
  rawText: string,
  fileName: string,
  employees: EmployeeRecord[],
  companies: CompanyRecord[],
  workplaces: WorkplaceRecord[]
): ProcessedRhidResult => {
  const lines = rawText.split(/\r?\n/);
  const alerts: AlertItem[] = [];
  const companyBuckets: Record<string, {
    company: CompanyRecord;
    lines: string[];
    employeeCounts: Record<string, number>;
  }> = {};

  // Find fallback company (usually Construtora ACPO / Cod 01)
  const fallbackCompany: CompanyRecord = companies.find(c => 
    c.dominio_code === "01" || c.dominio_code === "1" || c.name.toLowerCase().includes("construtora")
  ) || {
    id: "fallback-id",
    name: "CONSTRUTORA ACPO LTDA (Fallback)",
    dominio_code: "01"
  };

  const matchedEmployeeSummaries: Record<string, MatchedEmployeeSummary> = {};
  let validRecordsCount = 0;

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (trimmed.length < 35) {
      // Ignore empty or severely invalid short lines
      return;
    }

    validRecordsCount++;
    // Extração da matrícula na posição 7 a 11 (0-indexed)
    const rawMatricula = line.length >= 12 ? line.substring(7, 12) : trimmed.slice(7, 12);
    const emp = matchEmployee(rawMatricula, employees);

    let assignedCompany: CompanyRecord = fallbackCompany;
    let workplaceName = "Não definido";

    if (!emp) {
      alerts.push({
        rawMatricula,
        lineNumber: index + 1,
        reason: "Matrícula não encontrada no sistema. Aplicado código padrão (01 - CONSTRUTORA)."
      });
    } else {
      if (emp.workplace_id) {
        const wp = workplaces.find(w => w.id === emp.workplace_id);
        if (wp) workplaceName = wp.name;
      } else if (emp.unit) {
        workplaceName = emp.unit;
      }

      if (emp.company_id) {
        const comp = companies.find(c => c.id === emp.company_id);
        if (comp) {
          assignedCompany = comp;
          if (!comp.dominio_code) {
            alerts.push({
              rawMatricula,
              lineNumber: index + 1,
              employeeName: emp.name,
              reason: `Empresa (${comp.name}) sem Código Domínio. Aplicado padrão "0000000001".`
            });
          }
        } else {
          alerts.push({
            rawMatricula,
            lineNumber: index + 1,
            employeeName: emp.name,
            reason: "Empresa do colaborador não encontrada no banco. Aplicada CONSTRUTORA (01)."
          });
        }
      } else {
        alerts.push({
          rawMatricula,
          lineNumber: index + 1,
          employeeName: emp.name,
          reason: "Colaborador sem empresa atribuída na ficha. Aplicada CONSTRUTORA (01)."
        });
      }
    }

    const domainCodeStr = formatDomainCode(assignedCompany.dominio_code);

    // Substituir posições 33 a 42 pelo Código Domínio (10 dígitos)
    let newLine = line;
    if (line.length >= 43) {
      newLine = line.substring(0, 33) + domainCodeStr + line.substring(43);
    } else {
      const padded = line.padEnd(33, ' ');
      newLine = padded.substring(0, 33) + domainCodeStr;
    }

    const bucketKey = assignedCompany.id || assignedCompany.name;
    if (!companyBuckets[bucketKey]) {
      companyBuckets[bucketKey] = {
        company: assignedCompany,
        lines: [],
        employeeCounts: {}
      };
    }
    companyBuckets[bucketKey].lines.push(newLine);

    if (emp) {
      companyBuckets[bucketKey].employeeCounts[emp.id] = (companyBuckets[bucketKey].employeeCounts[emp.id] || 0) + 1;
      
      if (!matchedEmployeeSummaries[emp.id]) {
        const schedule = getStandardSchedule(emp, workplaces);
        const currentStart1 = (emp.work_schedule_start_1 || "").slice(0, 5);
        const expectedStart1 = schedule.start1.slice(0, 5);
        const needsScheduleUpdate = schedule.type !== 'GERAL' && currentStart1 !== expectedStart1;

        matchedEmployeeSummaries[emp.id] = {
          employeeId: emp.id,
          name: emp.name,
          registrationNumber: emp.registration_number || rawMatricula.trim(),
          companyName: assignedCompany.trading_name || assignedCompany.name,
          workplaceName,
          recordsCount: 0,
          schedule,
          needsScheduleUpdate
        };
      }
      matchedEmployeeSummaries[emp.id].recordsCount += 1;
    }
  });

  const matchedEmployeesList = Object.values(matchedEmployeeSummaries);

  const filesByCompany: CompanyOutputFile[] = Object.values(companyBuckets).map(bucket => {
    const compName = bucket.company.trading_name || bucket.company.name;
    const cleanFileName = `ponto_${formatCompanyNameForFile(compName)}.txt`;
    const dominioCode = formatDomainCode(bucket.company.dominio_code).replace(/^0+/, "") || "0";
    const bucketEmps = Object.keys(bucket.employeeCounts)
      .map(id => matchedEmployeeSummaries[id])
      .filter(Boolean);

    return {
      companyId: bucket.company.id,
      companyName: compName,
      dominioCode,
      fileName: cleanFileName,
      recordsCount: bucket.lines.length,
      content: bucket.lines.join("\r\n"),
      employees: bucketEmps
    };
  }).sort((a, b) => b.recordsCount - a.recordsCount);

  return {
    fileName,
    totalLines: lines.length,
    validRecordsCount,
    filesByCompany,
    alerts,
    matchedEmployeesList
  };
};
