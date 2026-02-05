import { http, HttpResponse } from 'msw';

export const handlers = [
  // Profiles
  http.get('/api/profiles', () => {
    return HttpResponse.json([
      { id: 1, name: 'Test User', email: 'test@example.com', is_primary: true, tsp_contribution_pct: 5, tsp_roth_pct: 0 },
    ]);
  }),

  http.get('/api/profiles/:id', ({ params }) => {
    return HttpResponse.json({
      id: Number(params.id), name: 'Test User', email: 'test@example.com', is_primary: true, tsp_contribution_pct: 5, tsp_roth_pct: 0,
    });
  }),

  // Accounts
  http.get('/api/accounts', () => {
    return HttpResponse.json([
      { id: 1, profile_id: 1, plaid_item_id: 1, name: 'Checking', account_type: 'checking', balance_current: 5000, is_hidden: false },
      { id: 2, profile_id: 1, plaid_item_id: 1, name: 'Savings', account_type: 'savings', balance_current: 15000, is_hidden: false },
    ]);
  }),

  http.get('/api/accounts/summary', () => {
    return HttpResponse.json({
      total_assets: 70000,
      total_liabilities: 14500,
      net_worth: 55500,
      accounts_by_type: { checking: { balance: 5000, count: 1 }, savings: { balance: 15000, count: 1 } },
    });
  }),

  // Transactions
  http.get('/api/transactions', () => {
    return HttpResponse.json({
      transactions: [
        { id: 1, account_id: 1, account_name: 'Checking', category_id: 1, category_name: 'Groceries', amount: 85.50, date: '2025-01-15', name: 'Whole Foods', is_excluded: false, is_transfer: false, pending: false },
        { id: 2, account_id: 1, account_name: 'Checking', category_id: 2, category_name: 'Salary', amount: -3500, date: '2025-01-01', name: 'DFAS Payroll', is_excluded: false, is_transfer: false, pending: false },
      ],
      total: 2,
      page: 1,
      page_size: 50,
      total_pages: 1,
    });
  }),

  http.get('/api/transactions/categories', () => {
    return HttpResponse.json([
      { id: 1, name: 'Groceries', is_income: false, is_system: true },
      { id: 2, name: 'Salary', is_income: true, is_system: true },
    ]);
  }),

  // Analytics
  http.get('/api/analytics/spending-by-category', () => {
    return HttpResponse.json([
      { category_id: 1, category_name: 'Groceries', category_color: '#22c55e', amount: 205.80, percentage: 65.3, transaction_count: 2 },
      { category_id: 3, category_name: 'Restaurants', category_color: '#ef4444', amount: 42.00, percentage: 13.3, transaction_count: 1 },
    ]);
  }),

  http.get('/api/analytics/cash-flow', () => {
    return HttpResponse.json({
      period_start: '2025-01-01',
      period_end: '2025-01-31',
      total_income: 3500,
      total_expenses: 263.79,
      net_cash_flow: 3236.21,
      income_by_category: [],
      expenses_by_category: [],
    });
  }),

  http.get('/api/analytics/monthly-trends', () => {
    return HttpResponse.json([
      { month: '2025-01', income: 3500, expenses: 263.79, net: 3236.21 },
    ]);
  }),

  http.get('/api/analytics/net-worth-history', () => {
    return HttpResponse.json([]);
  }),

  http.get('/api/analytics/insights', () => {
    return HttpResponse.json([]);
  }),

  // Budgets
  http.get('/api/budgets', () => {
    return HttpResponse.json([]);
  }),

  http.get('/api/budgets/summary', () => {
    return HttpResponse.json({
      month: '2025-01-01',
      total_budgeted: 0,
      total_spent: 0,
      total_income: 0,
      remaining: 0,
      categories_over_budget: 0,
    });
  }),

  // Plaid
  http.get('/api/plaid/items', () => {
    return HttpResponse.json([]);
  }),
];
