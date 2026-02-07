// Use the authenticated axios instance from services/api.ts
// This ensures all API calls include JWT auth headers and auto-refresh logic
import authenticatedApi from './services/api';
import type {
  Profile,
  PlaidItem,
  Account,
  Transaction,
  Category,
  Budget,
  BudgetItem,
  SpendingByCategory,
  MonthlyTrend,
  CashFlow,
  NetWorthSnapshot,
  SpendingInsight,
  TSPScenario,
  TSPProjectionResult,
  TSPFundHistory,
  RecurringTransaction,
  SavingsGoal,
  CategoryRule,
  AppNotification,
  UserSession,
} from './types';

const client = authenticatedApi;

// Profiles
export const profiles = {
  list: () => client.get<Profile[]>('/profiles').then(r => r.data),
  get: (id: number) => client.get<Profile>(`/profiles/${id}`).then(r => r.data),
  create: (data: Partial<Profile>) => client.post<Profile>('/profiles', data).then(r => r.data),
  update: (id: number, data: Partial<Profile>) => client.put<Profile>(`/profiles/${id}`, data).then(r => r.data),
  delete: (id: number) => client.delete(`/profiles/${id}`),
};

// Plaid
export const plaid = {
  getLinkToken: (profileId: number) =>
    client.post<{ link_token: string; expiration: string }>('/plaid/link-token', { profile_id: profileId }).then(r => r.data),
  exchangeToken: (profileId: number, publicToken: string, institutionId?: string, institutionName?: string) =>
    client.post<PlaidItem>('/plaid/exchange-token', {
      profile_id: profileId,
      public_token: publicToken,
      institution_id: institutionId,
      institution_name: institutionName,
    }).then(r => r.data),
  listItems: (profileId?: number) => {
    const params = profileId ? { profile_id: profileId } : {};
    return client.get<PlaidItem[]>('/plaid/items', { params }).then(r => r.data);
  },
  syncItem: (itemId: number) => client.post<{ added: number; modified: number; removed: number }>('/plaid/sync', { item_id: itemId }).then(r => r.data),
  syncAll: () => client.post('/plaid/sync').then(r => r.data),
  removeItem: (itemId: number) => client.delete(`/plaid/items/${itemId}`),
};

// Accounts
export const accounts = {
  list: (profileId?: number) => {
    const params = profileId ? { profile_id: profileId } : {};
    return client.get<Account[]>('/accounts', { params }).then(r => r.data);
  },
  get: (id: number) => client.get<Account>(`/accounts/${id}`).then(r => r.data),
  update: (id: number, data: { display_name?: string; is_hidden?: boolean }) =>
    client.put<Account>(`/accounts/${id}`, data).then(r => r.data),
  getSummary: (profileId?: number) => {
    const params = profileId ? { profile_id: profileId } : {};
    return client.get<{
      total_assets: number;
      total_liabilities: number;
      net_worth: number;
      accounts_by_type: Record<string, { balance: number; count: number }>;
    }>('/accounts/summary', { params }).then(r => r.data);
  },
};

// Transactions
export const transactions = {
  list: (params: {
    profile_id?: number;
    account_id?: number;
    category_id?: number;
    start_date?: string;
    end_date?: string;
    search?: string;
    page?: number;
    page_size?: number;
  }) => client.get<{ transactions: Transaction[]; total: number; page: number; page_size: number; total_pages: number }>('/transactions', { params }).then(r => r.data),
  get: (id: number) => client.get<Transaction>(`/transactions/${id}`).then(r => r.data),
  update: (id: number, data: {
    category_id?: number;
    custom_name?: string;
    notes?: string;
    is_excluded?: boolean;
    is_transfer?: boolean;
  }) => client.put<Transaction>(`/transactions/${id}`, data).then(r => r.data),
  bulkCategorize: (transactionIds: number[], categoryId: number) =>
    client.post('/transactions/bulk-categorize', { transaction_ids: transactionIds, category_id: categoryId }),
};

// Categories
export const categories = {
  list: () => client.get<Category[]>('/transactions/categories').then(r => r.data),
  getHierarchy: () => client.get<Category[]>('/transactions/categories/hierarchy').then(r => r.data),
};

// Budgets
export const budgets = {
  list: (profileId: number, month?: string) => {
    const params: Record<string, string | number> = { profile_id: profileId };
    if (month) {
      // Backend expects separate year and month integers
      const d = new Date(month);
      params.year = d.getFullYear();
      params.month = d.getMonth() + 1; // getMonth() is 0-indexed
    }
    return client.get<Budget[]>('/budgets', { params }).then(r => r.data);
  },
  get: (id: number) => client.get<Budget>(`/budgets/${id}`).then(r => r.data),
  create: (data: { profile_id: number; name: string; month: string; items?: Partial<BudgetItem>[] }) =>
    client.post<Budget>('/budgets', data).then(r => r.data),
  update: (id: number, data: Partial<Budget>) => client.put<Budget>(`/budgets/${id}`, data).then(r => r.data),
  delete: (id: number) => client.delete(`/budgets/${id}`),
  getProgress: (id: number) => client.get<{
    budget_id: number;
    month: string;
    items: (BudgetItem & { spent: number; remaining: number; percentage: number })[];
    total_budgeted: number;
    total_spent: number;
  }>(`/budgets/${id}/progress`).then(r => r.data),
  copyFromTemplate: (profileId: number, month: string) => {
    const d = new Date(month);
    return client.post<Budget>('/budgets/copy-from-template', null, {
      params: { profile_id: profileId, target_year: d.getFullYear(), target_month: d.getMonth() + 1 }
    }).then(r => r.data);
  },
};

// Analytics
export const analytics = {
  spendingByCategory: (params: { profile_id?: number; start_date?: string; end_date?: string }) =>
    client.get<SpendingByCategory[]>('/analytics/spending-by-category', { params }).then(r => r.data),
  cashFlow: (params: { profile_id?: number; start_date?: string; end_date?: string }) =>
    client.get<CashFlow>('/analytics/cash-flow', { params }).then(r => r.data),
  monthlyTrends: (params: { profile_id?: number; months?: number }) =>
    client.get<MonthlyTrend[]>('/analytics/monthly-trends', { params }).then(r => r.data),
  netWorthHistory: (params: { profile_id?: number; months?: number }) =>
    client.get<NetWorthSnapshot[]>('/analytics/net-worth-history', { params }).then(r => r.data),
  snapshotNetWorth: (profileId?: number) =>
    client.post('/analytics/snapshot-net-worth', null, { params: { profile_id: profileId } }).then(r => r.data),
  insights: (profileId?: number) =>
    client.get<SpendingInsight[]>('/analytics/insights', { params: { profile_id: profileId } }).then(r => r.data),
};

// TSP
export const tsp = {
  listScenarios: (profileId: number) =>
    client.get<TSPScenario[]>('/tsp/scenarios', { params: { profile_id: profileId } }).then(r => r.data),
  getScenario: (id: number) => client.get<TSPScenario>(`/tsp/scenarios/${id}`).then(r => r.data),
  createScenario: (data: Partial<TSPScenario>) => client.post<TSPScenario>('/tsp/scenarios', data).then(r => r.data),
  updateScenario: (id: number, data: Partial<TSPScenario>) =>
    client.put<TSPScenario>(`/tsp/scenarios/${id}`, data).then(r => r.data),
  deleteScenario: (id: number) => client.delete(`/tsp/scenarios/${id}`),
  project: (id: number) =>
    client.get<TSPProjectionResult>(`/tsp/scenarios/${id}/project`).then(r => r.data),
  compare: (scenarioIds: number[]) =>
    client.get<{ scenarios: any[]; comparison: any[] }>('/tsp/compare', { params: { scenario_ids: scenarioIds.join(',') } }).then(r => r.data),
  fundHistory: (years?: number) =>
    client.get<Record<string, TSPFundHistory>>('/tsp/fund-history', { params: { years } }).then(r => r.data),
};

// Recurring transactions
export const recurring = {
  list: (activeOnly = true) =>
    client.get<RecurringTransaction[]>('/recurring', { params: { active_only: activeOnly } }).then(r => r.data),
  create: (data: {
    name: string;
    amount: number;
    frequency: string;
    day_of_month?: number;
    day_of_week?: number;
    start_date: string;
    end_date?: string;
    category_id?: number;
    is_income?: boolean;
    notes?: string;
  }) => client.post<RecurringTransaction>('/recurring', data).then(r => r.data),
  update: (id: number, data: Partial<RecurringTransaction>) =>
    client.put<RecurringTransaction>(`/recurring/${id}`, data).then(r => r.data),
  delete: (id: number) => client.delete(`/recurring/${id}`),
  upcoming: (days = 30) =>
    client.get<RecurringTransaction[]>('/recurring/upcoming', { params: { days } }).then(r => r.data),
};

// Export
export const dataExport = {
  transactionsCsv: (params?: { start_date?: string; end_date?: string }) =>
    client.get('/export/transactions/csv', { params, responseType: 'blob' }).then(r => r.data),
  transactionsExcel: (params?: { start_date?: string; end_date?: string }) =>
    client.get('/export/transactions/excel', { params, responseType: 'blob' }).then(r => r.data),
};

// Savings Goals
export const goals = {
  list: (includeCompleted = false) =>
    client.get<SavingsGoal[]>('/goals', { params: { include_completed: includeCompleted } }).then(r => r.data),
  get: (id: number) => client.get<SavingsGoal>(`/goals/${id}`).then(r => r.data),
  create: (data: { name: string; target_amount: number; current_amount?: number; deadline?: string; color?: string; icon?: string }) =>
    client.post<SavingsGoal>('/goals', data).then(r => r.data),
  update: (id: number, data: Partial<SavingsGoal>) =>
    client.put<SavingsGoal>(`/goals/${id}`, data).then(r => r.data),
  contribute: (id: number, amount: number) =>
    client.post<SavingsGoal>(`/goals/${id}/contribute`, { amount }).then(r => r.data),
  delete: (id: number) => client.delete(`/goals/${id}`),
};

// Notifications
export const notifications = {
  list: (unreadOnly = false) =>
    client.get<AppNotification[]>('/notifications', { params: { unread_only: unreadOnly } }).then(r => r.data),
  unreadCount: () =>
    client.get<{ count: number }>('/notifications/unread-count').then(r => r.data),
  markRead: (id: number) =>
    client.put(`/notifications/${id}/read`).then(r => r.data),
  markAllRead: () =>
    client.put('/notifications/read-all').then(r => r.data),
  delete: (id: number) => client.delete(`/notifications/${id}`),
  checkBudgets: () =>
    client.post('/notifications/check-budgets').then(r => r.data),
  checkBills: () =>
    client.post('/notifications/check-bills').then(r => r.data),
};

// Auto-Categorization
export const categorization = {
  listRules: () =>
    client.get<CategoryRule[]>('/categorization/rules').then(r => r.data),
  createRule: (data: { category_id: number; match_field?: string; match_type?: string; match_value: string; priority?: number }) =>
    client.post<CategoryRule>('/categorization/rules', data).then(r => r.data),
  updateRule: (id: number, data: Partial<CategoryRule>) =>
    client.put<CategoryRule>(`/categorization/rules/${id}`, data).then(r => r.data),
  deleteRule: (id: number) => client.delete(`/categorization/rules/${id}`),
  applyRules: (uncategorizedOnly = true) =>
    client.post<{ categorized: number; skipped: number }>('/categorization/apply', null, { params: { uncategorized_only: uncategorizedOnly } }).then(r => r.data),
};

// Sessions
export const sessions = {
  list: () =>
    client.get<UserSession[]>('/sessions').then(r => r.data),
  revoke: (id: number) => client.delete(`/sessions/${id}`),
  revokeAllOthers: () => client.delete('/sessions'),
};

// Combined API object for easy importing
export const api = {
  profiles,
  plaid,
  accounts,
  transactions,
  categories,
  budgets,
  analytics,
  tsp,
  recurring,
  dataExport,
  goals,
  notifications,
  categorization,
  sessions,
};

export default api;
