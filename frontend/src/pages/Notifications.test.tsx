import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { screen, waitFor } from '../test/test-utils';
import { render } from '../test/test-utils';
import { server } from '../test/mocks/server';
import Notifications from './Notifications';

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('Notifications Page', () => {
  it('renders page title', () => {
    render(<Notifications />);
    expect(screen.getByText('Notifications')).toBeInTheDocument();
  });

  it('shows check now button', () => {
    render(<Notifications />);
    expect(screen.getByText('Check Now')).toBeInTheDocument();
  });

  it('renders notifications from API', async () => {
    render(<Notifications />);
    await waitFor(() => {
      expect(screen.getByText('Budget Warning')).toBeInTheDocument();
      expect(screen.getByText('Bill Due')).toBeInTheDocument();
    });
  });

  it('shows unread count', async () => {
    render(<Notifications />);
    await waitFor(() => {
      expect(screen.getByText('1 unread')).toBeInTheDocument();
    });
  });

  it('shows mark all read button when unread exist', async () => {
    render(<Notifications />);
    await waitFor(() => {
      expect(screen.getByText('Mark All Read')).toBeInTheDocument();
    });
  });
});
