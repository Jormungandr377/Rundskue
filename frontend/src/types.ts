// Profile types
export interface Profile {
  id: number;
  name: string;
  email?: string;
  is_primary: boolean;
  service_start_date?: string;
  base_pay?: number;
  tsp_contribution_pct?: number;
  tsp_roth_pct?: number;
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
  total_budgeted?: number;
  total_spent?: number;
  items: BudgetItem[];
}

export interface BudgetItem {
  id: number;
  budget_id?: number;
  category_id: number;
  amount?: number;
  budgeted?: number;
  spent?: number;
  remaining?: number;
  percent_used?: number;
  rollover_amount?: number;
  effective_budget?: number;
  category_name?: string;
  category_icon?: string;
  category_color?: string;
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
  age: number;
  starting_balance: number;
  contribution: number;
  employer_match: number;
  growth: number;
  ending_balance: number;
}

export interface TSPProjectionResult {
  scenario_name: string;
  years_to_retirement: number;
  final_balance: number;
  total_contributions: number;
  total_employer_match: number;
  total_growth: number;
  average_return_rate: number;
  projections: TSPProjection[];
}

export interface TSPFundHistory {
  fund: string;
  average_annual_return: number;
  total_return: number;
  data_points: number;
  start_date?: string;
  end_date?: string;
}

// Recurring transactions
export interface RecurringTransaction {
  id: number;
  name: string;
  amount: number;
  frequency: 'monthly' | 'weekly' | 'biweekly' | 'quarterly' | 'yearly';
  day_of_month?: number;
  day_of_week?: number;
  start_date: string;
  end_date?: string;
  next_due_date: string;
  category_id?: number;
  category_name?: string;
  is_income: boolean;
  is_active: boolean;
  notes?: string;
}

// Savings Goals
export interface SavingsGoal {
  id: number;
  name: string;
  target_amount: number;
  current_amount: number;
  deadline?: string;
  color: string;
  icon: string;
  is_completed: boolean;
  completed_at?: string;
  progress_pct: number;
  monthly_needed?: number;
}

// Category Rules (auto-categorization)
export interface CategoryRule {
  id: number;
  category_id: number;
  category_name?: string;
  match_field: 'name' | 'merchant_name';
  match_type: 'contains' | 'exact' | 'starts_with';
  match_value: string;
  is_active: boolean;
  priority: number;
}

// Notifications
export interface AppNotification {
  id: number;
  type: 'budget_alert' | 'bill_reminder' | 'goal_reached';
  title: string;
  message: string;
  data?: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
}

// Sessions
export interface UserSession {
  id: number;
  user_agent?: string;
  ip_address?: string;
  created_at: string;
  expires_at: string;
  is_current: boolean;
}

// Envelopes
export interface Envelope {
  id: number;
  profile_id: number;
  name: string;
  allocated_amount: number;
  spent_amount: number;
  remaining_amount: number;
  color: string;
  icon: string;
  is_active: boolean;
  transaction_count: number;
  created_at: string;
}

export interface EnvelopeSummary {
  total_allocated: number;
  total_spent: number;
  total_remaining: number;
  unallocated_income: number;
  envelope_count: number;
}

// Subscriptions
export interface SubscriptionItem {
  id: number;
  profile_id: number;
  name: string;
  merchant_name?: string;
  amount: number;
  frequency: string;
  category_id?: number;
  last_charged?: string;
  next_expected?: string;
  is_active: boolean;
  is_flagged_unused: boolean;
  notes?: string;
  created_at: string;
}

export interface SubscriptionSummary {
  total_monthly_cost: number;
  total_annual_cost: number;
  active_count: number;
  flagged_unused_count: number;
}

// Cash Flow Forecast
export interface CashFlowEvent {
  name: string;
  amount: number;
  type: string;
}

export interface CashFlowDay {
  date: string;
  projected_balance: number;
  events: CashFlowEvent[];
  cumulative_income: number;
  cumulative_expenses: number;
}

// Income vs Expense Comparison
export interface IncomeExpenseComparison {
  month: string;
  income: number;
  expenses: number;
  net: number;
  income_change_pct?: number;
  expense_change_pct?: number;
  net_change_pct?: number;
}

// Paycheck Rules
export interface PaycheckAllocation {
  id: number;
  target_type: string;
  target_id: number;
  amount_type: string;
  amount: number;
  priority: number;
}

export interface PaycheckRule {
  id: number;
  profile_id: number;
  name: string;
  match_merchant: string;
  match_amount_min?: number;
  match_amount_max?: number;
  is_active: boolean;
  allocations: PaycheckAllocation[];
}
