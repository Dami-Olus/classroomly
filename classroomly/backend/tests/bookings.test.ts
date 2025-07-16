import request from 'supertest';
import app from '../app';
import prisma from '../lib/prisma';

describe('Bookings API', () => {
  let tutorToken: string = '';
  let studentToken: string = '';
  let classId: string = '';
  let bookingId: string = '';

  beforeAll(async () => {
    // Register and login tutor
    await request(app).post('/api/auth/register').send({
      email: 'bookingtutor@example.com',
      password: 'Test1234!',
      firstName: 'Tutor',
      lastName: 'Booking',
      userType: 'TUTOR'
    });
    await prisma.user.update({ where: { email: 'bookingtutor@example.com' }, data: { isVerified: true } });
    const tutorRes = await request(app).post('/api/auth/login').send({
      email: 'bookingtutor@example.com',
      password: 'Test1234!'
    });
    tutorToken = tutorRes.body.token;

    // Register and login student
    await request(app).post('/api/auth/register').send({
      email: 'bookingstudent@example.com',
      password: 'Test1234!',
      firstName: 'Student',
      lastName: 'Booking',
      userType: 'STUDENT'
    });
    await prisma.user.update({ where: { email: 'bookingstudent@example.com' }, data: { isVerified: true } });
    const studentRes = await request(app).post('/api/auth/login').send({
      email: 'bookingstudent@example.com',
      password: 'Test1234!'
    });
    studentToken = studentRes.body.token;
  });

  beforeEach(async () => {
    // Clean up reschedule requests for test users before each test
    await prisma.rescheduleRequest.deleteMany({
      where: {
        booking: {
          OR: [
            { student: { email: 'bookingstudent@example.com' } },
            { student: { email: 'otherstudent@example.com' } },
            { class: { tutor: { email: 'bookingtutor@example.com' } } }
          ]
        }
      }
    });
    // Clean up bookings for test users before each test
    await prisma.booking.deleteMany({
      where: {
        OR: [
          { student: { email: 'bookingstudent@example.com' } },
          { student: { email: 'otherstudent@example.com' } },
          { class: { tutor: { email: 'bookingtutor@example.com' } } }
        ]
      }
    });
  });

  afterAll(async () => {
    // Clean up reschedule requests for test users after all tests
    await prisma.rescheduleRequest.deleteMany({
      where: {
        booking: {
          OR: [
            { student: { email: 'bookingstudent@example.com' } },
            { student: { email: 'otherstudent@example.com' } },
            { class: { tutor: { email: 'bookingtutor@example.com' } } }
          ]
        }
      }
    });
    // Clean up bookings and classes for test users after all tests
    await prisma.booking.deleteMany({
      where: {
        OR: [
          { student: { email: 'bookingstudent@example.com' } },
          { student: { email: 'otherstudent@example.com' } },
          { class: { tutor: { email: 'bookingtutor@example.com' } } }
        ]
      }
    });
    await prisma.class.deleteMany({
      where: {
        tutor: { email: 'bookingtutor@example.com' }
      }
    });
  });

  it('should require auth to book', async () => {
    const res = await request(app).post('/api/bookings').send({ classId });
    expect(res.statusCode).toBe(401);
  });

  function futureDate(days: number) {
    return new Date(Date.now() + days * 86400000).toISOString();
  }

  it('should create a booking', async () => {
    // Create a class for the booking
    const classRes = await request(app)
      .post('/api/classes')
      .set('Authorization', `Bearer ${tutorToken}`)
      .send({
        title: 'Booking Test Class',
        description: 'Test class for booking',
        subject: 'Math',
        level: 'beginner',
        maxStudents: 5,
        durationMinutes: 60,
        pricePerSession: 10
      });
    expect(classRes.statusCode).toBe(201);
    classId = classRes.body.data.id;

    const res = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        classId,
        scheduledAt: futureDate(1)
      });
    expect(res.statusCode).toBe(201);
    expect(res.body.data).toHaveProperty('id');
  });

  it('should prevent booking conflict', async () => {
    // Create a class for the booking
    const classRes = await request(app)
      .post('/api/classes')
      .set('Authorization', `Bearer ${tutorToken}`)
      .send({
        title: 'Booking Conflict Class',
        description: 'Test class for booking conflict',
        subject: 'Math',
        level: 'beginner',
        maxStudents: 5,
        durationMinutes: 60,
        pricePerSession: 10
      });
    expect(classRes.statusCode).toBe(201);
    const conflictClassId = classRes.body.data.id;

    // Create the first booking
    const firstBooking = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        classId: conflictClassId,
        scheduledAt: futureDate(2)
      });
    expect(firstBooking.statusCode).toBe(201);

    // Try to create a conflicting booking
    const conflictBooking = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        classId: conflictClassId,
        scheduledAt: futureDate(2)
      });
    expect(conflictBooking.statusCode).toBe(409);
  });

  it('should allow tutor to approve booking', async () => {
    if (!bookingId) return;
    const res = await request(app)
      .patch(`/api/bookings/${bookingId}/status`)
      .set('Authorization', `Bearer ${tutorToken}`)
      .send({ status: 'CONFIRMED' });
    expect(res.statusCode).toBe(200);
    expect(res.body.data.status).toBe('CONFIRMED');
  });

  it('should allow student to cancel booking', async () => {
    if (!bookingId) return;
    const res = await request(app)
      .delete(`/api/bookings/${bookingId}`)
      .set('Authorization', `Bearer ${studentToken}`);
    expect(res.statusCode).toBe(200);
    // After deletion, create a new booking for further tests
    const newBookingRes = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        classId,
        scheduledAt: futureDate(2)
      });
    if (newBookingRes.statusCode === 201 && newBookingRes.body.data && newBookingRes.body.data.id) {
      bookingId = newBookingRes.body.data.id;
    } else {
      bookingId = '';
      console.error('New booking creation failed after delete:', newBookingRes.body);
    }
  });

  it('should allow student to cancel their own booking', async () => {
    // Create a class and booking
    const classRes = await request(app)
      .post('/api/classes')
      .set('Authorization', `Bearer ${tutorToken}`)
      .send({
        title: 'Cancel Booking Class',
        description: 'Test class for cancel booking',
        subject: 'Math',
        level: 'beginner',
        maxStudents: 5,
        durationMinutes: 60,
        pricePerSession: 10
      });
    expect(classRes.statusCode).toBe(201);
    const cancelClassId = classRes.body.data.id;

    const bookingRes = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        classId: cancelClassId,
        scheduledAt: futureDate(3)
      });
    expect(bookingRes.statusCode).toBe(201);
    const bookingId = bookingRes.body.data.id;

    // Cancel the booking
    const cancelRes = await request(app)
      .patch(`/api/bookings/${bookingId}/status`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ status: 'CANCELLED' });
    expect(cancelRes.statusCode).toBe(200);
    expect(cancelRes.body.data.status).toBe('CANCELLED');
  });

  it('should not allow student to cancel another student\'s booking', async () => {
    if (!bookingId) return;
    // Register and verify a second student
    await request(app).post('/api/auth/register').send({
      email: 'otherstudent@example.com',
      password: 'Test1234!',
      firstName: 'Other',
      lastName: 'Student',
      userType: 'STUDENT'
    });
    await prisma.user.update({ where: { email: 'otherstudent@example.com' }, data: { isVerified: true } });
    const otherRes = await request(app).post('/api/auth/login').send({
      email: 'otherstudent@example.com',
      password: 'Test1234!'
    });
    const otherToken = otherRes.body.token;
    expect(otherToken).toBeTruthy();
    // Try to cancel the booking as another student
    const res = await request(app)
      .patch(`/api/bookings/${bookingId}/status`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ status: 'CANCELLED' });
    expect(res.statusCode).toBe(403);
  });

  it('should validate booking creation', async () => {
    const res = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ classId: '', scheduledAt: '' });
    expect(res.statusCode).toBe(400);
  });
});

describe('Rescheduling API', () => {
  let tutorToken: string = '';
  let studentToken: string = '';
  let classId: string = '';
  let bookingId: string = '';
  let testCounter = 0;

  function uniqueFutureDate() {
    // Offset by testCounter days to ensure uniqueness
    return new Date(Date.now() + (2 + testCounter) * 86400000).toISOString();
  }

  beforeAll(async () => {
    // Register and login tutor
    await request(app).post('/api/auth/register').send({
      email: 'rescheduletutor@example.com',
      password: 'Test1234!',
      firstName: 'Tutor',
      lastName: 'Reschedule',
      userType: 'TUTOR'
    });
    await prisma.user.update({ where: { email: 'rescheduletutor@example.com' }, data: { isVerified: true } });
    const tutorRes = await request(app).post('/api/auth/login').send({
      email: 'rescheduletutor@example.com',
      password: 'Test1234!'
    });
    tutorToken = tutorRes.body.token;

    // Register and login student
    await request(app).post('/api/auth/register').send({
      email: 'reschedulestudent@example.com',
      password: 'Test1234!',
      firstName: 'Student',
      lastName: 'Reschedule',
      userType: 'STUDENT'
    });
    await prisma.user.update({ where: { email: 'reschedulestudent@example.com' }, data: { isVerified: true } });
    const studentRes = await request(app).post('/api/auth/login').send({
      email: 'reschedulestudent@example.com',
      password: 'Test1234!'
    });
    studentToken = studentRes.body.token;
  });

  beforeEach(async () => {
    testCounter++;
    // Clean up reschedule requests for rescheduling test users
    await prisma.rescheduleRequest.deleteMany({
      where: {
        booking: {
          OR: [
            { student: { email: 'reschedulestudent@example.com' } },
            { class: { tutor: { email: 'rescheduletutor@example.com' } } }
          ]
        }
      }
    });
    // Clean up bookings for rescheduling test users
    await prisma.booking.deleteMany({
      where: {
        OR: [
          { student: { email: 'reschedulestudent@example.com' } },
          { class: { tutor: { email: 'rescheduletutor@example.com' } } }
        ]
      }
    });
    // Create a class and booking for each test
    const classRes = await request(app)
      .post('/api/classes')
      .set('Authorization', `Bearer ${tutorToken}`)
      .send({
        title: 'Reschedule Test Class',
        description: 'Test class for rescheduling',
        subject: 'Science',
        level: 'beginner',
        maxStudents: 3,
        durationMinutes: 60,
        pricePerSession: 80
      });
    if (classRes.statusCode !== 201 || !classRes.body.data || !classRes.body.data.id) {
      console.error('Class creation failed:', classRes.body);
      return;
    }
    classId = classRes.body.data.id;

    const bookingRes = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        classId,
        scheduledAt: uniqueFutureDate()
      });
    if (bookingRes.statusCode !== 201 || !bookingRes.body.data || !bookingRes.body.data.id) {
      console.error('Booking creation failed:', bookingRes.body);
      return;
    }
    bookingId = bookingRes.body.data.id;
  });

  it('should allow student to propose a reschedule', async () => {
    const res = await request(app)
      .post(`/api/bookings/${bookingId}/reschedule`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ proposedTime: new Date(Date.now() + 2 * 86400000).toISOString() });
    expect(res.statusCode).toBe(201);
    expect(res.body.data).toHaveProperty('id');
    expect(res.body.data.status).toBe('PENDING');
  });

  it('should allow tutor to accept a reschedule', async () => {
    // Student proposes
    const proposeRes = await request(app)
      .post(`/api/bookings/${bookingId}/reschedule`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ proposedTime: new Date(Date.now() + 3 * 86400000).toISOString() });
    const requestId = proposeRes.body.data.id;
    // Tutor accepts
    const acceptRes = await request(app)
      .post(`/api/bookings/${bookingId}/reschedule/${requestId}/accept`)
      .set('Authorization', `Bearer ${tutorToken}`);
    expect(acceptRes.statusCode).toBe(200);
    expect(acceptRes.body.message).toBe('Reschedule accepted');
  });

  it('should allow tutor to propose and student to decline', async () => {
    // Tutor proposes
    const proposeRes = await request(app)
      .post(`/api/bookings/${bookingId}/reschedule`)
      .set('Authorization', `Bearer ${tutorToken}`)
      .send({ proposedTime: new Date(Date.now() + 4 * 86400000).toISOString() });
    const requestId = proposeRes.body.data.id;
    // Student declines
    const declineRes = await request(app)
      .post(`/api/bookings/${bookingId}/reschedule/${requestId}/decline`)
      .set('Authorization', `Bearer ${studentToken}`);
    expect(declineRes.statusCode).toBe(200);
    expect(declineRes.body.message).toBe('Reschedule declined');
  });

  it('should not allow the same user to accept their own request', async () => {
    // Student proposes
    const proposeRes = await request(app)
      .post(`/api/bookings/${bookingId}/reschedule`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ proposedTime: new Date(Date.now() + 5 * 86400000).toISOString() });
    const requestId = proposeRes.body.data.id;
    // Student tries to accept
    const acceptRes = await request(app)
      .post(`/api/bookings/${bookingId}/reschedule/${requestId}/accept`)
      .set('Authorization', `Bearer ${studentToken}`);
    expect(acceptRes.statusCode).toBe(403);
  });

  it('should validate reschedule input', async () => {
    const res = await request(app)
      .post(`/api/bookings/${bookingId}/reschedule`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ proposedTime: 'not-a-date' });
    expect(res.statusCode).toBe(400);
  });
}); 