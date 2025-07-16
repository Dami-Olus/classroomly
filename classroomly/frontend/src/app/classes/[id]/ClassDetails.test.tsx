import { render, screen } from '@testing-library/react';
import ClassDetailsPage from './page';

describe('ClassDetailsPage', () => {
  it('renders class title and tutor info', () => {
    render(<ClassDetailsPage classData={{ title: 'Algebra 101', tutor: { firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com' }, subject: 'Math', pricePerSession: 50, durationMinutes: 60, maxStudents: 5, isActive: true, createdAt: '', id: '1' }} />);
    expect(screen.getByText(/algebra 101/i)).toBeInTheDocument();
    expect(screen.getByText(/jane doe/i)).toBeInTheDocument();
    expect(screen.getByText(/math/i)).toBeInTheDocument();
  });

  it('shows booking UI', () => {
    render(<ClassDetailsPage classData={{ title: 'Algebra 101', tutor: { firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com' }, subject: 'Math', pricePerSession: 50, durationMinutes: 60, maxStudents: 5, isActive: true, createdAt: '', id: '1' }} />);
    expect(screen.getByText(/book a session/i)).toBeInTheDocument();
  });
}); 