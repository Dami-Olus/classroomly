import { render, screen } from '@testing-library/react';
import Dashboard from './page';

describe('Dashboard', () => {
  it('renders welcome message for tutor', () => {
    render(<Dashboard userType="TUTOR" firstName="Jane" lastName="Doe" stats={{ classes: 2, bookings: 5, pendingBookings: 1, totalEarnings: 200, upcomingSessions: 1, completedSessions: 3 }} />);
    expect(screen.getByText(/welcome back, jane/i)).toBeInTheDocument();
    expect(screen.getByText(/manage your classes/i)).toBeInTheDocument();
  });

  it('renders welcome message for student', () => {
    render(<Dashboard userType="STUDENT" firstName="John" lastName="Smith" stats={{ classes: 0, bookings: 3, pendingBookings: 0, totalEarnings: 0, upcomingSessions: 2, completedSessions: 1 }} />);
    expect(screen.getByText(/welcome back, john/i)).toBeInTheDocument();
    expect(screen.getByText(/discover great tutors/i)).toBeInTheDocument();
  });
}); 