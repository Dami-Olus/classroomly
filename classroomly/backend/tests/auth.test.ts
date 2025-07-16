import request from 'supertest';
import app from '../app';

describe('Auth API', () => {
  it('should return 401 for invalid login', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'fake@example.com', password: 'wrong' });
    expect(res.statusCode).toBe(401);
  });
}); 