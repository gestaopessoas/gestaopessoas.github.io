export type BenefitCategory = 'Todos' | 'Saúde' | 'Alimentação' | 'Educação' | 'Lazer' | 'Serviços';

export interface DiscountPartner {
  id: string;
  name: string;
  category: string;
  discount_rules: string;
  promocodes: string[];
  logo_url: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface PartnerLead {
  id?: string;
  partner_id: string;
  employee_id: string;
  status?: string;
  created_at?: string;
}
