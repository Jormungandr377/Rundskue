import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { screen, waitFor } from '../test/test-utils';
import { render } from '../test/test-utils';
import { server } from '../test/mocks/server';
import Goals from './Goals';

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('Goals Page', () => {
  it('renders page title', async () => {
    render(<Goals />);
    expect(screen.getByText('Savings Goals')).toBeInTheDocument();
  });

  it('renders summary cards', async () => {
    render(<Goals />);
    await waitFor(() => {
      expect(screen.getByText('Active Goals')).toBeInTheDocument();
      expect(screen.getByText('Total Saved')).toBeInTheDocument();
      expect(screen.getByText('Remaining Target')).toBeInTheDocument();
    });
  });

  it('renders goal names from API', async () => {
    render(<Goals />);
    await waitFor(() => {
      expect(screen.getByText('Emergency Fund')).toBeInTheDocument();
    });
  });

  it('shows new goal button', () => {
    render(<Goals />);
    expect(screen.getByText('New Goal')).toBeInTheDocument();
  });

  it('shows progress percentage', async () => {
    render(<Goals />);
    await waitFor(() => {
      expect(screen.getByText('30%')).toBeInTheDocument();
    });
  });

  it('shows contribute button for active goals', async () => {
    render(<Goals />);
    await waitFor(() => {
      expect(screen.getByText('+ Add Contribution')).toBeInTheDocument();
    });
  });
});
