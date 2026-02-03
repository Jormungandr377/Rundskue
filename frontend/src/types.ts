// Profile types
export interface Profile {
  id: number;
  name: string;
  email?: string;
  is_primary: boolean;
  service_start_date?: string;
  base_pay?: number;
  tsp_contribution_pct: number;
  tsp_roth_pct: number;
  created_at: string;
  plaid_items?: PlaidItem[];
}

// Plaid types
export interface PlaidItem {
  id: number;
  institution_name?: string;
  is_active: boolean;
  last_sync?: string;
  error_code?: string;
  error_message?: string;
  account_count: number;
  accounts?: Account[];
}

// Account types
export type AccountType = 'checking' | 'savings' | 'credit' | 'investment' | 'loan' | 'mortgage' | 'other';

export interface Account {
  id: number;
  profile_id: number;
  name: string;
  official_name?: string;
  account_type: AccountType;
  subtype?: string;
  mask?: string;
  balance_current: number;
  balance_available?: number;
  balance_limit?: number;
  is_hidden: boolean;
  display_name?: string;
}

// Transaction types
export interface Transaction {
  id: number;
  account_id: number;
  category_id?: number;
  amount: number;
  date: string;
  name: string;
  merchant_name?: string;
  custom_name?: string;
  notes?: string;
  is_excluded: boolean;
  is_transfer: boolean;
  pending: boolean;
  category?: Category;
  account?: Account;
}

// Category types
export interface Category {
  id: number;
  name: string;
  parent_id?: number;
  icon?: string;
  color?: string;
  is_income: boolean;
  is_system: boolean;
  children?: Category[];
}

// Budget types
export interface Budget {
  id: number;
  profile_id: number;
  name: string;
  month: string;
  is_template: boolean;
  items: BudgetItem[];
}

export interface BudgetItem {
  id: number;
  budget_id: number;
  category_id: number;
  amount: number;
  spent?: number;
  category?: Category;
}

// Analytics types
export interface SpendingByCategory {
  category_id?: number;
  category_name: string;
  category_icon?: string;
  category_color?: string;
  amount: number;
  percentage: number;
  transaction_count: number;
}

export interface MonthlyTrend {
  month: string;
  income: number;
  expenses: number;
  net: number;
}

export interface CashFlow {
  period_start: string;
  period_end: string;
  total_income: number;
  total_expenses: number;
  net_cash_flow: number;
  income_by_category: SpendingByCategory[];
  expenses_by_category: SpendingByCategory[];
}

export interface NetWorthSnapshot {
  date: string;
  total_assets: number;
  total_liabilities: number;
  net_worth: number;
  change_from_previous?: number;
}

export interface SpendingInsight {
  type: 'increase' | 'decrease' | 'over_budget' | 'unusual';
  category: string;
  message: string;
  amount: number;
  percentage_change?: number;
}

// TSP types
export interface TSPScenario {
  id: number;
  profile_id: number;
  name: string;
  is_active: boolean;
  current_balance: number;
  current_balance_date?: string;
  contribution_pct: number;
  base_pay?: number;
  annual_pay_increase_pct: number;
  allocation_g: number;
  allocation_f: number;
  allocation_c: number;
  allocation_s: number;
  allocation_i: number;
  allocation_l: number;
  l_fund_year?: number;
  use_historical_returns: boolean;
  custom_annual_return_pct?: number;
  retirement_age: number;
  birth_year?: number;
}

export interface TSPProjection {
  year: number;
  age?: number;
  base_pay: number;
  contribution: number;
  employer_match: number;
  growth: number;
  balance: number;
}

export interface TSPProjectionResult {
  scenario_id: number;
  scenario_name: string;
  projections: TSPProjection[];
  final_balance: number;
  total_contributions: number;
  total_employer_match: number;
  total_growth: number;
  average_annual_return: number;
  years_projected: number;
}

export interface TSPFundHistory {
  fund: string;
  average_annual_return: number;
  total_return: number;
  data_points: number;
  start_date?: string;
  end_date?: string;
}
