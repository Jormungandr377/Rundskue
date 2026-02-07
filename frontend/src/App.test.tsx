import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from './test/mocks/server';
import App from './App';

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function renderApp() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  // App already includes BrowserRouter, so we only wrap with QueryClient
  return render(
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  );
}

describe('App', () => {
  it('renders sidebar navigation after auth', async () => {
    renderApp();
    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Accounts')).toBeInTheDocument();
      expect(screen.getByText('Transactions')).toBeInTheDocument();
      expect(screen.getByText('Budgets')).toBeInTheDocument();
      expect(screen.getByText('Reports')).toBeInTheDocument();
      expect(screen.getByText('TSP Simulator')).toBeInTheDocument();
    });
  });

  it('renders new nav items (Goals, Auto-Categorize)', async () => {
    renderApp();
    await waitFor(() => {
      expect(screen.getByText('Savings Goals')).toBeInTheDocument();
      expect(screen.getByText('Auto-Categorize')).toBeInTheDocument();
      expect(screen.getByText('Bills & Subs')).toBeInTheDocument();
    });
  });

  it('renders footer nav items', async () => {
    renderApp();
    await waitFor(() => {
      expect(screen.getByText('Link Account')).toBeInTheDocument();
      expect(screen.getByText('Profiles')).toBeInTheDocument();
    });
  });

  it('renders app title', async () => {
    renderApp();
    await waitFor(() => {
      expect(screen.getByText(/Finance Tracker/)).toBeInTheDocument();
    });
  });
});
