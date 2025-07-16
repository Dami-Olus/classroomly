import request from 'supertest';
import app from '../app';
import prisma from '../lib/prisma';

describe('Classes API', () => {
  let token: string;
  let classId: string;

  beforeAll(async () => {
    // Register and login a tutor
    await request(app).post('/api/auth/register').send({
      email: 'classtest@example.com',
      password: 'Test1234!',
      firstName: 'Tutor',
      lastName: 'Test',
      userType: 'TUTOR'
    });
    // Auto-verify the user for testing
    await prisma.user.update({ where: { email: 'classtest@example.com' }, data: { isVerified: true } });
    const res = await request(app).post('/api/auth/login').send({
      email: 'classtest@example.com',
      password: 'Test1234!'
    });
    token = res.body.token;
    if (!token) {
      console.error('Login failed:', res.body);
      throw new Error('Failed to get token for tutor');
    }
  });

  it('should require auth to create class', async () => {
    const res = await request(app).post('/api/classes').send({ title: 'Test Class' });
    expect(res.statusCode).toBe(401);
  });

  it('should create a class', async () => {
    const res = await request(app)
      .post('/api/classes')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Test Class',
        subject: 'Math',
        maxStudents: 5,
        durationMinutes: 60,
        pricePerSession: 100
      });
    expect(res.statusCode).toBe(201);
    classId = res.body.data && res.body.data.id;
    if (!classId) {
      console.error('Class creation failed:', res.body);
      throw new Error('Failed to get classId');
    }
  });

  it('should list classes', async () => {
    const res = await request(app).get('/api/classes');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('should get class details', async () => {
    const res = await request(app).get(`/api/classes/${classId}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.title).toBe('Test Class');
  });

  it('should update class', async () => {
    const res = await request(app)
      .put(`/api/classes/${classId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Updated Class' });
    expect(res.statusCode).toBe(200);
    expect(res.body.data.title).toBe('Updated Class');
  });

  it('should delete class', async () => {
    const res = await request(app)
      .delete(`/api/classes/${classId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(200);
  });

  it('should validate class creation', async () => {
    const res = await request(app)
      .post('/api/classes')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: '', subject: 'Math', maxStudents: 1, durationMinutes: 15, pricePerSession: 1 });
    expect(res.statusCode).toBe(400);
  });
}); 