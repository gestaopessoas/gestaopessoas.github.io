export type BenefitCategory = 'Todos' | 'Saúde' | 'Alimentação' | 'Educação' | 'Lazer' | 'Serviços';

export interface DiscountPartner {
  id: string;
  name: string;
  category: string;
  discount_rules: string;
  contact_info: string;
  how_to_use: string;
  logo_url: string;
  logo_position?: string;
  logo_dark_mask?: boolean;
  instagram_url?: string;
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
