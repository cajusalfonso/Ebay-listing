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
  updated_at: string;
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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
