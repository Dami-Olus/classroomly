import { render, screen, fireEvent } from '@testing-library/react';
import ProfilePage from './page';

describe('ProfilePage', () => {
  it('renders user info', () => {
    render(<ProfilePage user={{ firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com', userType: 'TUTOR', bio: 'Math tutor', hourlyRate: 50, subjects: 'Math, Physics', timezone: 'UTC' }} />);
    expect(screen.getByText(/jane doe/i)).toBeInTheDocument();
    expect(screen.getByText(/math tutor/i)).toBeInTheDocument();
    expect(screen.getByText(/math/i)).toBeInTheDocument();
    expect(screen.getByText(/physics/i)).toBeInTheDocument();
  });

  it('can switch to edit mode', () => {
    render(<ProfilePage user={{ firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com', userType: 'TUTOR', bio: 'Math tutor', hourlyRate: 50, subjects: 'Math, Physics', timezone: 'UTC' }} />);
    fireEvent.click(screen.getByRole('button', { name: /edit profile/i }));
    expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/last name/i)).toBeInTheDocument();
  });
}); 