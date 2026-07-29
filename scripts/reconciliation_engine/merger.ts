import { RgsEmployee } from "./parsers/rgsExcel";
import { SolidesEmployee } from "./parsers/solidesJson";
import { DominioEmployee } from "./parsers/dominioPdf";
import { CustosEmployee } from "./parsers/custosExcel";

export interface MasterRecord {
  cpf: string;
  name: string;
  registrationNumber?: string;
  department?: string;
  role?: string;
  admissionDate?: string;
  email?: string;
  phone?: string;
  gender?: string;
  sourceCompany?: string;
  costCenter?: string;
  careerPlan?: string;
  benefits?: string;
  contractType?: string;
  baseSalary?: number;
  status: "OK" | "WARNING" | "ERROR";
  messages: string[];
}

export class Merger {
  private rgsMapByCpf = new Map<string, RgsEmployee>();
  private rgsMapByName = new Map<string, RgsEmployee>();
  private masterRecords = new Map<string, MasterRecord>();

  constructor(private rgsData: RgsEmployee[]) {
    // Build lookup tables from RGS (Source of Truth)
    for (const emp of rgsData) {
      if (emp.cpf) this.rgsMapByCpf.set(emp.cpf, emp);
      if (emp.nameNormalized) this.rgsMapByName.set(emp.nameNormalized, emp);

      // Initialize master record from RGS
      this.masterRecords.set(emp.cpf || emp.nameNormalized, {
        cpf: emp.cpf,
        name: emp.name,
        registrationNumber: emp.registrationNumber,
        department: emp.department,
        role: emp.role,
        admissionDate: emp.admissionDate ? new Date(emp.admissionDate).toLocaleDateString("pt-BR") : undefined,
        status: "OK",
        messages: ["Inicializado do RGS"]
      });
    }
  }

  public mergeDominio(dominioData: DominioEmployee[], companyInfo: string) {
    for (const emp of dominioData) {
      // Tenta achar por CPF, senao por Nome
      let master: MasterRecord | undefined;
      
      if (emp.cpf && this.rgsMapByCpf.has(emp.cpf)) {
        master = this.masterRecords.get(emp.cpf);
      } else if (emp.nameNormalized && this.rgsMapByName.has(emp.nameNormalized)) {
        const rgsEmp = this.rgsMapByName.get(emp.nameNormalized)!;
        master = this.masterRecords.get(rgsEmp.cpf || rgsEmp.nameNormalized);
      }

      if (master) {
        master.registrationNumber = emp.registrationNumber;
        master.sourceCompany = companyInfo;
        if (!master.cpf && emp.cpf) master.cpf = emp.cpf; // Injeta CPF se achou no pdf
        if (emp.admissionDate) master.admissionDate = emp.admissionDate;
        master.messages.push(`Vinculado ao Domínio (${companyInfo})`);
      } else {
        // Novo! Nao existe no RGS.
        const id = emp.cpf || emp.nameNormalized;
        this.masterRecords.set(id, {
          cpf: emp.cpf || "",
          name: emp.name,
          registrationNumber: emp.registrationNumber,
          sourceCompany: companyInfo,
          admissionDate: emp.admissionDate,
          status: "WARNING",
          messages: [`Encontrado no Domínio (${companyInfo}), mas NÃO ESTÁ no RGS.`]
        });
      }
    }
  }

  public mergeSolides(solidesData: SolidesEmployee[]) {
    for (const emp of solidesData) {
      // Solides JSON doesn't have CPF directly in this sample, we use Name
      let master: MasterRecord | undefined;
      
      if (emp.nameNormalized && this.rgsMapByName.has(emp.nameNormalized)) {
        const rgsEmp = this.rgsMapByName.get(emp.nameNormalized)!;
        master = this.masterRecords.get(rgsEmp.cpf || rgsEmp.nameNormalized);
      }

      if (master) {
        master.email = emp.email || master.email;
        master.phone = emp.phone || master.phone;
        master.gender = emp.gender || master.gender;
        if (emp.role && master.role && emp.role.toUpperCase() !== master.role.toUpperCase()) {
          master.status = "WARNING";
          master.messages.push(`Divergência de Cargo: RGS diz '${master.role}', Sólides diz '${emp.role}'`);
        }
        master.messages.push(`Vinculado ao Sólides`);
      } else {
        // Novo! Nao existe no RGS.
        this.masterRecords.set(emp.nameNormalized, {
          cpf: "",
          name: emp.name,
          email: emp.email,
          phone: emp.phone,
          role: emp.role,
          department: emp.department,
          status: "WARNING",
          messages: [`Encontrado no Sólides, mas NÃO ESTÁ no RGS.`]
        });
      }
    }
  }

  public mergeCustos(custosData: CustosEmployee[]) {
    for (const emp of custosData) {
      let master: MasterRecord | undefined;
      
      if (emp.registrationNumber && emp.registrationNumber.toLowerCase() !== "pj") {
        // Find by matricula
        master = Array.from(this.masterRecords.values()).find(m => m.registrationNumber === emp.registrationNumber);
      }
      
      if (!master && emp.nameNormalized) {
        if (this.rgsMapByName.has(emp.nameNormalized)) {
          const rgsEmp = this.rgsMapByName.get(emp.nameNormalized)!;
          master = this.masterRecords.get(rgsEmp.cpf || rgsEmp.nameNormalized);
        } else {
           master = this.masterRecords.get(emp.nameNormalized);
        }
      }

      if (master) {
        master.costCenter = emp.costCenter;
        master.careerPlan = emp.careerPlan;
        master.benefits = emp.benefits;
        master.contractType = emp.contractType;
        master.baseSalary = emp.baseSalary;
        master.messages.push(`Vinculado a Planilha de Custos (${emp.status})`);
      } else {
        // Novo! Nao existe no RGS e nem no Dominio
        this.masterRecords.set(emp.nameNormalized, {
          cpf: "",
          name: emp.name,
          registrationNumber: emp.registrationNumber !== "PJ" ? emp.registrationNumber : undefined,
          role: emp.role,
          department: emp.department,
          costCenter: emp.costCenter,
          careerPlan: emp.careerPlan,
          contractType: emp.contractType,
          baseSalary: emp.baseSalary,
          benefits: emp.benefits,
          status: emp.status === "ATIVO" ? "WARNING" : "OK",
          messages: [`Encontrado nos Custos (${emp.status}), mas NÃO ESTÁ no RGS.`]
        });
      }
    }
  }

  public getMasterRecords(): MasterRecord[] {
    return Array.from(this.masterRecords.values());
  }
}
