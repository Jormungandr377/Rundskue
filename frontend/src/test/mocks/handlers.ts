import { http, HttpResponse } from 'msw';

const BASE = 'http://localhost:8000/api';

export const handlers = [
  // Profiles
  http.get(`${BASE}/profiles`, () =>
    HttpResponse.json([
      { id: 1, name: 'Test User', email: 'test@example.com', is_primary: true },
    ])
  ),
  http.get(`${BASE}/profiles/:id`, () =>
    HttpResponse.json({ id: 1, name: 'Test User', email: 'test@example.com', is_primary: true })
  ),

  // Accounts
  http.get(`${BASE}/accounts`, () =>
    HttpResponse.json([
      { id: 1, profile_id: 1, name: 'Checking', account_type: 'checking', balance_current: 5500, is_hidden: false },
      { id: 2, profile_id: 1, name: 'Savings', account_type: 'savings', balance_current: 50000, is_hidden: false },
    ])
  ),
  http.get(`${BASE}/accounts/summary`, () =>
    HttpResponse.json({
      total_assets: 70000,
      total_liabilities: 14500,
      net_worth: 55500,
      accounts_by_type: {
        checking: { balance: 5500, count: 1 },
        savings: { balance: 50000, count: 1 },
      },
    })
  ),

  // Transactions
  http.get(`${BASE}/transactions`, () =>
    HttpResponse.json({
      transactions: [
        { id: 1, account_id: 1, amount: -45.99, date: '2025-01-15', name: 'Grocery Store', is_excluded: false, is_transfer: false, pending: false },
        { id: 2, account_id: 1, amount: -217.80, date: '2025-01-14', name: 'Electric Company', is_excluded: false, is_transfer: false, pending: false },
      ],
      total: 2,
      page: 1,
      page_size: 50,
      total_pages: 1,
    })
  ),

  // Categories
  http.get(`${BASE}/transactions/categories`, () =>
    HttpResponse.json([
      { id: 1, name: 'Groceries', is_income: false, is_system: true },
      { id: 2, name: 'Utilities', is_income: false, is_system: true },
      { id: 3, name: 'Salary', is_income: true, is_system: true },
    ])
  ),

  // Analytics
  http.get(`${BASE}/analytics/spending-by-category`, () =>
    HttpResponse.json([
      { category_name: 'Groceries', amount: 245.99, percentage: 48, transaction_count: 5 },
      { category_name: 'Utilities', amount: 217.80, percentage: 42, transaction_count: 2 },
    ])
  ),
  http.get(`${BASE}/analytics/cash-flow`, () =>
    HttpResponse.json({
      period_start: '2025-01-01',
      period_end: '2025-01-31',
      total_income: 3500,
      total_expenses: 263.79,
      net_cash_flow: 3236.21,
      income_by_category: [],
      expenses_by_category: [],
    })
  ),
  http.get(`${BASE}/analytics/monthly-trends`, () =>
    HttpResponse.json([
      { month: '2025-01', income: 3500, expenses: 263.79, net: 3236.21 },
    ])
  ),
  http.get(`${BASE}/analytics/insights`, () =>
    HttpResponse.json([])
  ),
  http.get(`${BASE}/analytics/net-worth-history`, () =>
    HttpResponse.json([
      { date: '2025-01-01', total_assets: 70000, total_liabilities: 14500, net_worth: 55500 },
    ])
  ),

  // Savings Goals
  http.get(`${BASE}/goals`, () =>
    HttpResponse.json([
      { id: 1, name: 'Emergency Fund', target_amount: 10000, current_amount: 3000, color: '#3b82f6', icon: 'piggy-bank', is_completed: false, progress_pct: 30, monthly_needed: 583.33 },
      { id: 2, name: 'Vacation', target_amount: 2000, current_amount: 2000, color: '#10b981', icon: 'plane', is_completed: true, progress_pct: 100 },
    ])
  ),
  http.post(`${BASE}/goals`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json(
      { id: 3, ...body, current_amount: body.current_amount ?? 0, color: body.color ?? '#3b82f6', icon: body.icon ?? 'piggy-bank', is_completed: false, progress_pct: 0 },
      { status: 201 }
    );
  }),
  http.post(`${BASE}/goals/:id/contribute`, () =>
    HttpResponse.json({ id: 1, name: 'Emergency Fund', target_amount: 10000, current_amount: 3500, progress_pct: 35, is_completed: false })
  ),
  http.delete(`${BASE}/goals/:id`, () => HttpResponse.json({ message: 'Deleted' })),

  // Notifications
  http.get(`${BASE}/notifications`, () =>
    HttpResponse.json([
      { id: 1, type: 'budget_alert', title: 'Budget Warning', message: 'Groceries at 85%', is_read: false, created_at: '2025-01-15T10:00:00Z' },
      { id: 2, type: 'bill_reminder', title: 'Bill Due', message: 'Electric bill due in 2 days', is_read: true, created_at: '2025-01-14T08:00:00Z' },
    ])
  ),
  http.get(`${BASE}/notifications/unread-count`, () =>
    HttpResponse.json({ count: 1 })
  ),
  http.put(`${BASE}/notifications/read-all`, () => HttpResponse.json({ message: 'All marked read' })),
  http.put(`${BASE}/notifications/:id/read`, () => HttpResponse.json({ message: 'Marked read' })),
  http.delete(`${BASE}/notifications/:id`, () => HttpResponse.json({ message: 'Deleted' })),
  http.post(`${BASE}/notifications/check-budgets`, () => HttpResponse.json({ alerts_created: 2 })),
  http.post(`${BASE}/notifications/check-bills`, () => HttpResponse.json({ reminders_created: 1 })),

  // Auto-Categorization
  http.get(`${BASE}/categorization/rules`, () =>
    HttpResponse.json([
      { id: 1, category_id: 1, category_name: 'Groceries', match_field: 'merchant_name', match_type: 'contains', match_value: 'walmart', is_active: true, priority: 1 },
    ])
  ),
  http.post(`${BASE}/categorization/rules`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({ id: 2, ...body, is_active: true }, { status: 201 });
  }),
  http.delete(`${BASE}/categorization/rules/:id`, () => HttpResponse.json({ message: 'Deleted' })),
  http.post(`${BASE}/categorization/apply`, () => HttpResponse.json({ categorized: 5, skipped: 3 })),

  // Sessions
  http.get(`${BASE}/sessions`, () =>
    HttpResponse.json([
      { id: 1, user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', ip_address: '192.168.1.1', created_at: '2025-01-15T10:00:00Z', expires_at: '2025-01-22T10:00:00Z', is_current: true },
      { id: 2, user_agent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)', ip_address: '10.0.0.1', created_at: '2025-01-14T08:00:00Z', expires_at: '2025-01-21T08:00:00Z', is_current: false },
    ])
  ),
  http.delete(`${BASE}/sessions/:id`, () => HttpResponse.json({ message: 'Session revoked' })),
  http.delete(`${BASE}/sessions`, () => HttpResponse.json({ message: 'Revoked 1 other sessions' })),

  // Recurring
  http.get(`${BASE}/recurring`, () =>
    HttpResponse.json([
      { id: 1, name: 'Rent', amount: 1200, frequency: 'monthly', day_of_month: 1, start_date: '2024-01-01', next_due_date: '2025-02-01', is_income: false, is_active: true },
    ])
  ),
  http.get(`${BASE}/recurring/upcoming`, () =>
    HttpResponse.json([
      { id: 1, name: 'Rent', amount: 1200, frequency: 'monthly', next_due_date: '2025-02-01', is_income: false, is_active: true },
    ])
  ),

  // Auth
  http.get(`${BASE}/auth/me`, () =>
    HttpResponse.json({ id: 1, email: 'admin@financetracker.app', is_active: true, totp_enabled: false, theme: 'dark' })
  ),
  http.post(`${BASE}/auth/login`, () =>
    HttpResponse.json({ access_token: 'mock-jwt-token', token_type: 'bearer' })
  ),
  http.post(`${BASE}/auth/refresh`, () =>
    HttpResponse.json({ access_token: 'mock-refreshed-token', token_type: 'bearer' })
  ),
  http.post(`${BASE}/auth/logout`, () => HttpResponse.json({ message: 'Logged out' })),
];
