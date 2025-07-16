import request from 'supertest';
import app from '../app';
import prisma from '../lib/prisma';

describe('Profile API', () => {
  let token: string;

  beforeAll(async () => {
    // Register and login a user to get a token
    await request(app).post('/api/auth/register').send({
      email: 'profiletest@example.com',
      password: 'Test1234!',
      firstName: 'Test',
      lastName: 'User',
      userType: 'STUDENT'
    });
    // Auto-verify the user for testing
    await prisma.user.update({ where: { email: 'profiletest@example.com' }, data: { isVerified: true } });
    const res = await request(app).post('/api/auth/login').send({
      email: 'profiletest@example.com',
      password: 'Test1234!'
    });
    token = res.body.token;
    if (!token) {
      console.error('Login failed:', res.body);
      throw new Error('Failed to get token for profile test');
    }
  });

  it('should require auth to view profile', async () => {
    const res = await request(app).get('/api/profile');
    expect(res.statusCode).toBe(401);
  });

  it('should return user profile with valid token', async () => {
    const res = await request(app)
      .get('/api/profile')
      .set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.email).toBe('profiletest@example.com');
  });

  it('should update profile', async () => {
    const res = await request(app)
      .put('/api/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ firstName: 'Updated', lastName: 'User' });
    expect(res.statusCode).toBe(200);
    expect(res.body.data.firstName).toBe('Updated');
  });

  it('should validate profile update', async () => {
    const res = await request(app)
      .put('/api/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ firstName: '' });
    expect(res.statusCode).toBe(400);
  });
}); 