import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { server } from './test/mocks/server';
import { profiles, accounts, transactions, analytics, categories, goals, notifications, categorization, sessions } from './api';

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('API Client', () => {
  describe('profiles', () => {
    it('lists profiles', async () => {
      const data = await profiles.list();
      expect(data).toHaveLength(1);
      expect(data[0].name).toBe('Test User');
    });

    it('gets a single profile', async () => {
      const data = await profiles.get(1);
      expect(data.name).toBe('Test User');
      expect(data.is_primary).toBe(true);
    });
  });

  describe('accounts', () => {
    it('lists accounts', async () => {
      const data = await accounts.list();
      expect(data).toHaveLength(2);
      expect(data[0].name).toBe('Checking');
    });

    it('gets account summary', async () => {
      const data = await accounts.getSummary();
      expect(data.net_worth).toBe(55500);
      expect(data.total_assets).toBe(70000);
    });
  });

  describe('transactions', () => {
    it('lists transactions with pagination', async () => {
      const data = await transactions.list({});
      expect(data.transactions).toHaveLength(2);
      expect(data.total).toBe(2);
      expect(data.page).toBe(1);
    });
  });

  describe('categories', () => {
    it('lists categories', async () => {
      const data = await categories.list();
      expect(data.length).toBeGreaterThan(0);
      expect(data[0]).toHaveProperty('name');
    });
  });

  describe('analytics', () => {
    it('gets spending by category', async () => {
      const data = await analytics.spendingByCategory({});
      expect(data).toHaveLength(2);
      expect(data[0].category_name).toBe('Groceries');
    });

    it('gets cash flow', async () => {
      const data = await analytics.cashFlow({});
      expect(data.total_income).toBe(3500);
      expect(data.total_expenses).toBe(263.79);
    });

    it('gets monthly trends', async () => {
      const data = await analytics.monthlyTrends({});
      expect(data).toHaveLength(1);
      expect(data[0].month).toBe('2025-01');
    });
  });

  describe('goals', () => {
    it('lists goals', async () => {
      const data = await goals.list();
      expect(data).toHaveLength(2);
      expect(data[0].name).toBe('Emergency Fund');
    });

    it('creates a goal', async () => {
      const data = await goals.create({ name: 'New Car', target_amount: 25000 });
      expect(data.name).toBe('New Car');
      expect(data.target_amount).toBe(25000);
    });

    it('contributes to a goal', async () => {
      const data = await goals.contribute(1, 500);
      expect(data.current_amount).toBe(3500);
      expect(data.progress_pct).toBe(35);
    });
  });

  describe('notifications', () => {
    it('lists notifications', async () => {
      const data = await notifications.list();
      expect(data).toHaveLength(2);
      expect(data[0].type).toBe('budget_alert');
    });

    it('gets unread count', async () => {
      const data = await notifications.unreadCount();
      expect(data.count).toBe(1);
    });

    it('checks budgets', async () => {
      const data = await notifications.checkBudgets();
      expect(data.alerts_created).toBe(2);
    });

    it('checks bills', async () => {
      const data = await notifications.checkBills();
      expect(data.reminders_created).toBe(1);
    });
  });

  describe('categorization', () => {
    it('lists rules', async () => {
      const data = await categorization.listRules();
      expect(data).toHaveLength(1);
      expect(data[0].match_value).toBe('walmart');
    });

    it('applies rules', async () => {
      const data = await categorization.applyRules();
      expect(data.categorized).toBe(5);
      expect(data.skipped).toBe(3);
    });
  });

  describe('sessions', () => {
    it('lists sessions', async () => {
      const data = await sessions.list();
      expect(data).toHaveLength(2);
      expect(data[0].is_current).toBe(true);
    });
  });
});
