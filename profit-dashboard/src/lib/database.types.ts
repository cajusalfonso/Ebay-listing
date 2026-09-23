export type Order = {
  id: string;
  user_id: string;
  order_date: string;
  product_name: string;
  sales_channel: string;
  supplier: string;
  sale_price: number;
  purchase_price: number;
  purchase_currency: string;
  exchange_rate: number;
  shipping_cost: number;
  payment_fee_percent: number;
  other_costs: number;
  status: string;
  is_return: boolean;
  return_cost: number;
  created_at: string;
  updated_at: string;
};

export type FixedCost = {
  id: string;
  user_id: string;
  label: string;
  category: string;
  amount: number;
  rhythm: string;
  start_date: string;
  created_at: string;
};

export type BankTransaction = {
  id: string;
  user_id: string;
  tx_date: string;
  amount: number;
  description: string;
  type: string;
  created_at: string;
};

export type Settings = {
  user_id: string;
  margin_threshold_percent: number;
  vat_rate_percent: number;
  default_payment_fee_percent: number;
  updated_at: string;
};

export type Debt = {
  id: string;
  user_id: string;
  label: string;
  total_amount: number;
  notes: string;
  created_at: string;
};

export type DebtPayment = {
  id: string;
  user_id: string;
  debt_id: string;
  payment_date: string;
  amount: number;
  note: string;
  created_at: string;
};

export type Supplier = {
  id: string;
  user_id: string;
  company_name: string;
  contact_person: string;
  email: string;
  phone: string;
  messenger: string;
  country: string;
  vat_id: string;
  address: string;
  platform: string;
  notes: string;
  created_at: string;
};

export type ModelSpec = "EU" | "US";

export type ProductModel = {
  id: string;
  user_id: string;
  supplier_id: string;
  model: string;
  storage: string;
  color: string;
  purchase_price_net: number;
  sale_price_gross: number;
  purchase_date: string;
  notes: string;
  spec: ModelSpec;
  created_at: string;
};

export type ModelCategory = {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
};

export type ModelCategoryLink = {
  id: string;
  user_id: string;
  model_id: string;
  category_id: string;
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      orders: {
        Row: Order;
        Insert: Partial<Order> & { user_id: string };
        Update: Partial<Order>;
        Relationships: [];
      };
      fixed_costs: {
        Row: FixedCost;
        Insert: Partial<FixedCost> & { user_id: string };
        Update: Partial<FixedCost>;
        Relationships: [];
      };
      bank_transactions: {
        Row: BankTransaction;
        Insert: Partial<BankTransaction> & { user_id: string };
        Update: Partial<BankTransaction>;
        Relationships: [];
      };
      settings: {
        Row: Settings;
        Insert: Partial<Settings> & { user_id: string };
        Update: Partial<Settings>;
        Relationships: [];
      };
      debts: {
        Row: Debt;
        Insert: Partial<Debt> & { user_id: string };
        Update: Partial<Debt>;
        Relationships: [];
      };
      debt_payments: {
        Row: DebtPayment;
        Insert: Partial<DebtPayment> & { user_id: string; debt_id: string };
        Update: Partial<DebtPayment>;
        Relationships: [];
      };
      suppliers: {
        Row: Supplier;
        Insert: Partial<Supplier> & { user_id: string };
        Update: Partial<Supplier>;
        Relationships: [];
      };
      product_models: {
        Row: ProductModel;
        Insert: Partial<ProductModel> & { user_id: string; supplier_id: string };
        Update: Partial<ProductModel>;
        Relationships: [];
      };
      model_categories: {
        Row: ModelCategory;
        Insert: Partial<ModelCategory> & { user_id: string };
        Update: Partial<ModelCategory>;
        Relationships: [];
      };
      model_category_links: {
        Row: ModelCategoryLink;
        Insert: Partial<ModelCategoryLink> & {
          user_id: string;
          model_id: string;
          category_id: string;
        };
        Update: Partial<ModelCategoryLink>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
