import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { screen, waitFor } from '../test/test-utils';
import { render } from '../test/test-utils';
import { server } from '../test/mocks/server';
import CategoryRules from './CategoryRules';

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('CategoryRules Page', () => {
  it('renders page title', () => {
    render(<CategoryRules />);
    expect(screen.getByText('Auto-Categorization Rules')).toBeInTheDocument();
  });

  it('renders rules from API', async () => {
    render(<CategoryRules />);
    await waitFor(() => {
      expect(screen.getByText('walmart')).toBeInTheDocument();
    });
  });

  it('shows apply rules button', () => {
    render(<CategoryRules />);
    expect(screen.getByText('Apply Rules')).toBeInTheDocument();
  });
});
