export type Item = {
  item_id: string | number;
  name: string;
  name_sec_lang: string;
  description: string;
  tax_id: string | number;
  tax_percentage: number;
  tax_country_code: string;
  is_taxable: boolean;
};