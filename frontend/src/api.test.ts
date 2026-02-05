import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { server } from './test/mocks/server';
import { profiles, accounts, transactions, analytics, categories } from './api';

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
});
