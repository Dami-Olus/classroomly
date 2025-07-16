import { render, screen } from '@testing-library/react';
import TutorBookingCalendar from './TutorBookingCalendar';

describe('TutorBookingCalendar', () => {
  it('renders calendar and available slots', () => {
    render(<TutorBookingCalendar tutorId="1" />);
    expect(screen.getByText(/book a session/i)).toBeInTheDocument();
    // You may want to mock fetch and check for slot rendering
  });
}); 