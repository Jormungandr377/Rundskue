import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { screen, waitFor } from '../test/test-utils';
import { render } from '../test/test-utils';
import { server } from '../test/mocks/server';
import Sessions from './Sessions';

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('Sessions Page', () => {
  it('renders page title', () => {
    render(<Sessions />);
    expect(screen.getByText('Active Sessions')).toBeInTheDocument();
  });

  it('renders sessions from API', async () => {
    render(<Sessions />);
    await waitFor(() => {
      expect(screen.getByText(/192\.168\.1\.1/)).toBeInTheDocument();
    });
  });

  it('identifies current session', async () => {
    render(<Sessions />);
    await waitFor(() => {
      expect(screen.getByText('Current Session')).toBeInTheDocument();
    });
  });

  it('shows revoke all button', async () => {
    render(<Sessions />);
    await waitFor(() => {
      expect(screen.getByText('Log Out Other Devices')).toBeInTheDocument();
    });
  });
});
