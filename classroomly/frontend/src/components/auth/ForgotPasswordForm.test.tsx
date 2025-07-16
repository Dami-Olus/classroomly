import { render, screen, fireEvent } from '@testing-library/react';
import ForgotPasswordForm from './ForgotPasswordForm';

describe('ForgotPasswordForm', () => {
  it('renders email field', () => {
    render(<ForgotPasswordForm />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
  });

  it('shows validation error for empty email', async () => {
    render(<ForgotPasswordForm />);
    fireEvent.click(screen.getByRole('button', { name: /reset password/i }));
    expect(await screen.findByText(/email is required/i)).toBeInTheDocument();
  });

  it('calls onSubmit with valid email', async () => {
    const handleSubmit = jest.fn();
    render(<ForgotPasswordForm onSubmit={handleSubmit} />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'test@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /reset password/i }));
    await screen.findByRole('button', { name: /reset password/i });
    expect(handleSubmit).toHaveBeenCalledWith({ email: 'test@example.com' });
  });
}); 