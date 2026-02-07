import axios from 'axios'

// In production, use relative URLs since frontend and backend are served from same domain
// In development, use the full localhost URL for Vite proxy
const API_BASE = import.meta.env.PROD
  ? '/api'  // Production: relative URL
  : (import.meta.env.VITE_API_URL || 'http://localhost:8000/api')  // Development: full URL

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Send cookies (refresh token) with requests
})

// --- Auth token management ---
let accessToken: string | null = null

export const setAccessToken = (token: string | null) => {
  accessToken = token
}

export const getAccessToken = () => accessToken

// Request interceptor: attach access token to every request
api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`
  }
  return config
})

// Response interceptor: auto-refresh on 401
let isRefreshing = false
let refreshSubscribers: ((token: string) => void)[] = []

const onRefreshed = (token: string) => {
  refreshSubscribers.forEach((cb) => cb(token))
  refreshSubscribers = []
}

const addRefreshSubscriber = (cb: (token: string) => void) => {
  refreshSubscribers.push(cb)
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    // Don't intercept login, register, or refresh requests
    const isAuthRequest = originalRequest?.url?.includes('/auth/login') ||
      originalRequest?.url?.includes('/auth/register') ||
      originalRequest?.url?.includes('/auth/refresh')

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthRequest) {
      if (isRefreshing) {
        // Queue this request until refresh completes
        return new Promise((resolve) => {
          addRefreshSubscriber((token: string) => {
            originalRequest.headers.Authorization = `Bearer ${token}`
            resolve(api(originalRequest))
          })
        })
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        const response = await api.post('/auth/refresh')
        const newToken = response.data.access_token
        setAccessToken(newToken)
        onRefreshed(newToken)
        isRefreshing = false

        originalRequest.headers.Authorization = `Bearer ${newToken}`
        return api(originalRequest)
      } catch (refreshError) {
        isRefreshing = false
        refreshSubscribers = []
        setAccessToken(null)
        // Redirect to login
        window.location.href = '/login'
        return Promise.reject(refreshError)
      }
    }

    return Promise.reject(error)
  }
)

// --- Auth Types ---
export interface AuthTokens {
  access_token: string
  token_type: string
}

export interface AuthUser {
  id: number
  email: string
  is_active: boolean
  totp_enabled: boolean
  created_at?: string
}

export interface TwoFactorSetupResponse {
  secret: string
  qr_code: string
  backup_codes: string[]
}

// --- Auth API ---
export const authApi = {
  register: (data: { email: string; password: string; remember_me?: boolean }) =>
    api.post<AuthTokens>('/auth/register', data).then(r => r.data),
  login: (data: { email: string; password: string; remember_me?: boolean; totp_code?: string }) =>
    api.post<AuthTokens>('/auth/login', data).then(r => r.data),
  refresh: () =>
    api.post<AuthTokens>('/auth/refresh').then(r => r.data),
  logout: () =>
    api.post('/auth/logout').then(r => r.data),
  me: () =>
    api.get<AuthUser>('/auth/me').then(r => r.data),
  setup2FA: (password: string) =>
    api.post<TwoFactorSetupResponse>('/auth/2fa/setup', { password }).then(r => r.data),
  verify2FA: (totp_code: string) =>
    api.post('/auth/2fa/verify', { totp_code }).then(r => r.data),
  disable2FA: (data: { password: string; totp_code?: string }) =>
    api.post('/auth/2fa/disable', data).then(r => r.data),
  forgotPassword: (email: string) =>
    api.post('/auth/forgot-password', { email }).then(r => r.data),
  resetPassword: (data: { token: string; new_password: string }) =>
    api.post('/auth/reset-password', data).then(r => r.data),
  changePassword: (data: { current_password: string; new_password: string }) =>
    api.post('/auth/change-password', data).then(r => r.data),
}

// Types
export interface Profile {
  id: number
  name: string
  email?: string
  is_primary: boolean
  service_start_date?: string
  base_pay?: number
  tsp_contribution_pct: number
  tsp_roth_pct: number
}

export interface Account {
  id: number
  profile_id: number
  name: string
  account_type: string
  balance_current: number
  balance_available?: number
  mask?: string
  institution_name?: string
  is_hidden: boolean
}

export interface Transaction {
  id: number
  account_id: number
  account_name: string
  category_id?: number
  category_name?: string
  amount: number
  date: string
  name: string
  merchant_name?: string
  is_excluded: boolean
  is_transfer: boolean
  pending: boolean
}

export interface Category {
  id: number
  name: string
  parent_id?: number
  icon?: string
  color?: string
  is_income: boolean
}

export interface BudgetItem {
  category_id: number
  category_name: string
  category_icon?: string
  category_color?: string
  budgeted: number
  spent: number
  remaining: number
  percent_used: number
}

export interface SpendingByCategory {
  category_id?: number
  category_name: string
  category_icon?: string
  category_color?: string
  amount: number
  percentage: number
  transaction_count: number
}

export interface MonthlyTrend {
  month: string
  income: number
  expenses: number
  net: number
}

export interface TSPScenario {
  id?: number
  profile_id: number
  name: string
  current_balance: number
  contribution_pct: number
  base_pay: number
  annual_pay_increase_pct: number
  allocation: {
    g: number
    f: number
    c: number
    s: number
    i: number
    l: number
    l_fund_year?: number
  }
  use_historical_returns: boolean
  custom_annual_return_pct?: number
  retirement_age: number
  birth_year: number
}

// Profiles API
export const profilesApi = {
  getAll: () => api.get<Profile[]>('/profiles'),
  get: (id: number) => api.get<Profile>(`/profiles/${id}`),
  create: (data: Partial<Profile>) => api.post<Profile>('/profiles', data),
  update: (id: number, data: Partial<Profile>) => api.put<Profile>(`/profiles/${id}`, data),
  delete: (id: number) => api.delete(`/profiles/${id}`),
}

// Plaid API
export const plaidApi = {
  getLinkToken: (profileId: number) => 
    api.post<{ link_token: string }>('/plaid/link-token', { profile_id: profileId }),
  exchangeToken: (data: { public_token: string; profile_id: number; institution_id?: string; institution_name?: string }) =>
    api.post('/plaid/exchange-token', data),
  getItems: (profileId?: number) => 
    api.get('/plaid/items', { params: { profile_id: profileId } }),
  sync: (itemId?: number) => 
    api.post('/plaid/sync', null, { params: { item_id: itemId } }),
  deleteItem: (itemId: number) => 
    api.delete(`/plaid/items/${itemId}`),
}

// Accounts API
export const accountsApi = {
  getAll: (profileId?: number, includeHidden?: boolean) => 
    api.get<Account[]>('/accounts', { params: { profile_id: profileId, include_hidden: includeHidden } }),
  getSummary: (profileId?: number) => 
    api.get('/accounts/summary', { params: { profile_id: profileId } }),
  update: (id: number, data: { is_hidden?: boolean; display_name?: string }) => 
    api.put(`/accounts/${id}`, data),
}

// Transactions API
export const transactionsApi = {
  getAll: (params: {
    profile_id?: number
    account_id?: number
    category_id?: number
    start_date?: string
    end_date?: string
    search?: string
    page?: number
    page_size?: number
  }) => api.get<{ transactions: Transaction[]; total: number; page: number; total_pages: number }>('/transactions', { params }),
  update: (id: number, data: Partial<Transaction>) => 
    api.put(`/transactions/${id}`, data),
  bulkCategorize: (transactionIds: number[], categoryId: number) =>
    api.post('/transactions/bulk-categorize', { transaction_ids: transactionIds, category_id: categoryId }),
}

// Categories API
export const categoriesApi = {
  getAll: () => api.get<Category[]>('/categories'),
}

// Budgets API
export const budgetsApi = {
  getAll: (profileId: number, year?: number, month?: number) =>
    api.get('/budgets', { params: { profile_id: profileId, year, month } }),
  getSummary: (profileId: number, year: number, month: number) =>
    api.get('/budgets/summary', { params: { profile_id: profileId, year, month } }),
  create: (data: { profile_id: number; name: string; month: string; items: { category_id: number; amount: number }[] }) =>
    api.post('/budgets', data),
  update: (id: number, items: { category_id: number; amount: number }[]) =>
    api.put(`/budgets/${id}`, items),
  delete: (id: number) => api.delete(`/budgets/${id}`),
}

// Analytics API
export const analyticsApi = {
  getSpendingByCategory: (params: { profile_id?: number; start_date?: string; end_date?: string }) =>
    api.get<SpendingByCategory[]>('/analytics/spending-by-category', { params }),
  getCashFlow: (params: { profile_id?: number; start_date?: string; end_date?: string }) =>
    api.get('/analytics/cash-flow', { params }),
  getMonthlyTrends: (profileId?: number, months?: number) =>
    api.get<MonthlyTrend[]>('/analytics/monthly-trends', { params: { profile_id: profileId, months } }),
  getNetWorthHistory: (profileId?: number, months?: number) =>
    api.get('/analytics/net-worth-history', { params: { profile_id: profileId, months } }),
  createNetWorthSnapshot: (profileId?: number) =>
    api.post('/analytics/snapshot-net-worth', null, { params: { profile_id: profileId } }),
  getInsights: (profileId?: number) =>
    api.get('/analytics/insights', { params: { profile_id: profileId } }),
}

// TSP API
export const tspApi = {
  getScenarios: (profileId: number) =>
    api.get<TSPScenario[]>('/tsp/scenarios', { params: { profile_id: profileId } }),
  createScenario: (data: TSPScenario) =>
    api.post('/tsp/scenarios', data),
  deleteScenario: (id: number) =>
    api.delete(`/tsp/scenarios/${id}`),
  project: (scenarioId: number) =>
    api.get(`/tsp/scenarios/${scenarioId}/project`),
  projectCustom: (data: TSPScenario) =>
    api.post('/tsp/project', data),
  compare: (scenarioIds: number[]) =>
    api.get('/tsp/compare', { params: { scenario_ids: scenarioIds.join(',') } }),
  getFundPerformance: () =>
    api.get('/tsp/fund-performance'),
  calculateBRSMatch: (basePay: number, contributionPct: number) =>
    api.get('/tsp/brs-match', { params: { base_pay: basePay, contribution_pct: contributionPct } }),
  getContributionLimits: () =>
    api.get('/tsp/contribution-limits'),
}

export default api
