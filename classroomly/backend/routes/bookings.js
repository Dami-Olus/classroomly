const express = require('express');
const { PrismaClient, BookingStatus, PaymentStatus } = require('@prisma/client');
const { authenticateUser } = require('../middleware/auth');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { z } = require('zod');

const router = express.Router();
const prisma = new PrismaClient();

// Generate shareable booking link (tutors only)
router.post('/generate-link', authenticateUser, async (req, res) => {
  try {
    const { classId, expiresAt } = req.body;
    const userId = req.user.id;

    // Check if user is a tutor
    if (req.user.userType !== 'TUTOR') {
      return res.status(403).json({ message: 'Only tutors can generate booking links' });
    }

    // Check if class exists and belongs to the tutor
    const classData = await prisma.class.findUnique({
      where: { id: classId }
    });

    if (!classData) {
      return res.status(404).json({ message: 'Class not found' });
    }

    if (classData.tutorId !== userId) {
      return res.status(403).json({ message: 'You can only generate links for your own classes' });
    }

    // Generate unique token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAtDate = expiresAt ? new Date(expiresAt) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // Default 7 days

    // Create booking link
    const bookingLink = await prisma.bookingLink.create({
      data: {
        token,
        classId,
        tutorId: userId,
        expiresAt: expiresAtDate,
        isActive: true
      },
      include: {
        class: {
          select: {
            id: true,
            title: true,
            subject: true,
            durationMinutes: true,
            pricePerSession: true
          }
        }
      }
    });

    const shareableUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/book/${token}`;

    res.status(201).json({ 
      data: {
        ...bookingLink,
        shareableUrl
      }
    });
  } catch (error) {
    console.error('Error generating booking link:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get booking link info (public)
router.get('/link/:token', async (req, res) => {
  try {
    const { token } = req.params;

    const bookingLink = await prisma.bookingLink.findUnique({
      where: { token },
      include: {
        class: {
          include: {
            tutor: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                bio: true,
                subjects: true,
                hourlyRate: true
              }
            }
          }
        }
      }
    });

    if (!bookingLink) {
      return res.status(404).json({ message: 'Booking link not found' });
    }

    if (!bookingLink.isActive) {
      return res.status(400).json({ message: 'This booking link is no longer active' });
    }

    if (bookingLink.expiresAt < new Date()) {
      return res.status(400).json({ message: 'This booking link has expired' });
    }

    res.json({ data: bookingLink });
  } catch (error) {
    console.error('Error fetching booking link:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Create booking via shareable link (public)
router.post('/link/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const { scheduledAt, notes, studentName, studentEmail } = req.body;

    // Validate booking link
    const bookingLink = await prisma.bookingLink.findUnique({
      where: { token },
      include: {
        class: true
      }
    });

    if (!bookingLink) {
      return res.status(404).json({ message: 'Booking link not found' });
    }

    if (!bookingLink.isActive) {
      return res.status(400).json({ message: 'This booking link is no longer active' });
    }

    if (bookingLink.expiresAt < new Date()) {
      return res.status(400).json({ message: 'This booking link has expired' });
    }

    // Check if class is still active
    if (!bookingLink.class.isActive) {
      return res.status(400).json({ message: 'This class is no longer available for booking' });
    }

    // Check if the scheduled time is in the future
    const scheduledDate = new Date(scheduledAt);
    if (scheduledDate <= new Date()) {
      return res.status(400).json({ message: 'Booking must be scheduled for a future time' });
    }

    // Find or create student user
    let student = await prisma.user.findUnique({
      where: { email: studentEmail }
    });

    if (!student) {
      // Create new student account with default password
      const defaultPassword = crypto.randomBytes(16).toString('hex'); // Generate random password
      const passwordHash = await bcrypt.hash(defaultPassword, 10);
      
      student = await prisma.user.create({
        data: {
          email: studentEmail,
          firstName: studentName.split(' ')[0] || studentName,
          lastName: studentName.split(' ').slice(1).join(' ') || '',
          userType: 'STUDENT',
          isVerified: true, // Auto-verify for booking links
          isActive: true,
          passwordHash: passwordHash,
          subjects: '' // Default empty subjects for students
        }
      });
    }

    // Check for booking conflicts
    const existingBooking = await prisma.booking.findFirst({
      where: {
        studentId: student.id,
        scheduledAt: {
          gte: new Date(scheduledDate.getTime() - 30 * 60 * 1000),
          lte: new Date(scheduledDate.getTime() + 30 * 60 * 1000)
        }
      }
    });

    // Check for tutor conflicts (tutor already has a booking at this time)
    const tutorConflict = await prisma.booking.findFirst({
      where: {
        class: {
          tutorId: bookingLink.class.tutorId
        },
        scheduledAt: {
          gte: new Date(scheduledDate.getTime() - 30 * 60 * 1000),
          lte: new Date(scheduledDate.getTime() + 30 * 60 * 1000)
        },
        status: {
          in: ['PENDING', 'CONFIRMED']
        }
      }
    });

    if (existingBooking) {
      return res.status(409).json({ message: 'You already have a booking at this time' });
    }

    if (tutorConflict) {
      return res.status(409).json({ message: 'The tutor is not available at this time' });
    }

    // Create the booking
    const booking = await prisma.booking.create({
      data: {
        classId: bookingLink.classId,
        studentId: student.id,
        tutorId: bookingLink.class.tutorId, // <-- Add this line
        scheduledAt: scheduledDate,
        notes: notes || '',
        status: BookingStatus.PENDING,
        totalAmount: bookingLink.class.pricePerSession
      },
      include: {
        class: {
          include: {
            tutor: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true
              }
            }
          }
        },
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    res.status(201).json({ data: booking });
  } catch (error) {
    console.error('Error creating booking via link:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Tutor schedules class for student
router.post('/schedule', authenticateUser, async (req, res) => {
  try {
    const { classId, studentEmail, scheduledAt, notes } = req.body;
    const userId = req.user.id;

    // Check if user is a tutor
    if (req.user.userType !== 'TUTOR') {
      return res.status(403).json({ message: 'Only tutors can schedule classes' });
    }

    // Check if class exists and belongs to the tutor
    const classData = await prisma.class.findUnique({
      where: { id: classId }
    });

    if (!classData) {
      return res.status(404).json({ message: 'Class not found' });
    }

    if (classData.tutorId !== userId) {
      return res.status(403).json({ message: 'You can only schedule classes for your own classes' });
    }

    if (!classData.isActive) {
      return res.status(400).json({ message: 'This class is not active' });
    }

    // Find student by email
    const student = await prisma.user.findUnique({
      where: { email: studentEmail }
    });

    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    if (student.userType !== 'STUDENT') {
      return res.status(400).json({ message: 'The provided email does not belong to a student' });
    }

    // Check if the scheduled time is in the future
    const scheduledDate = new Date(scheduledAt);
    if (scheduledDate <= new Date()) {
      return res.status(400).json({ message: 'Booking must be scheduled for a future time' });
    }

    // Check for booking conflicts
    const existingBooking = await prisma.booking.findFirst({
      where: {
        studentId: student.id,
        scheduledAt: {
          gte: new Date(scheduledDate.getTime() - 30 * 60 * 1000),
          lte: new Date(scheduledDate.getTime() + 30 * 60 * 1000)
        }
      }
    });

    // Check for tutor conflicts (tutor already has a booking at this time)
    const tutorConflict = await prisma.booking.findFirst({
      where: {
        class: {
          tutorId: classData.tutorId
        },
        scheduledAt: {
          gte: new Date(scheduledDate.getTime() - 30 * 60 * 1000),
          lte: new Date(scheduledDate.getTime() + 30 * 60 * 1000)
        },
        status: {
          in: ['PENDING', 'CONFIRMED']
        }
      }
    });

    if (existingBooking) {
      return res.status(400).json({ message: 'Student already has a booking at this time' });
    }

    if (tutorConflict) {
      return res.status(400).json({ message: 'You are not available at this time' });
    }

    // Create the booking
    const booking = await prisma.booking.create({
      data: {
        classId,
        studentId: student.id,
        tutorId: classData.tutorId, // <-- Add this line
        scheduledAt: scheduledDate,
        notes: notes || '',
        status: BookingStatus.CONFIRMED, // Auto-confirm when tutor schedules
        totalAmount: classData.pricePerSession
      },
      include: {
        class: {
          include: {
            tutor: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true
              }
            }
          }
        },
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    res.status(201).json({ data: booking });
  } catch (error) {
    console.error('Error scheduling class:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get all bookings for the authenticated user
router.get('/', authenticateUser, async (req, res) => {
  try {
    const userId = req.user.id;
    const userType = req.user.userType;
    const { classId } = req.query;

    let bookings;
    if (userType === 'TUTOR') {
      // Tutors see bookings for their classes
      const where = {
        class: {
          tutorId: userId
        }
      };
      
      // Add classId filter if provided
      if (classId) {
        where.classId = classId;
      }
      
      bookings = await prisma.booking.findMany({
        where,
        include: {
          class: {
            select: {
              id: true,
              title: true,
              subject: true,
              durationMinutes: true,
              pricePerSession: true,
              tutor: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true
                }
              }
            }
          },
          student: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          }
        },
        orderBy: {
          scheduledAt: 'desc'
        }
      });
    } else {
      // Students see their own bookings
      const where = {
        studentId: userId
      };
      
      // Add classId filter if provided
      if (classId) {
        where.classId = classId;
      }
      
      bookings = await prisma.booking.findMany({
        where,
        include: {
          class: {
            select: {
              id: true,
              title: true,
              subject: true,
              durationMinutes: true,
              pricePerSession: true,
              tutor: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true
                }
              }
            }
          },
          student: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          }
        },
        orderBy: {
          scheduledAt: 'desc'
        }
      });
    }

    res.json({ data: bookings.map(b => ({
      ...b,
      tutorId: b.class?.tutor?.id // flatten for frontend use
    })) });
  } catch (error) {
    console.error('Error fetching bookings:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get all bookings for a tutor (public, for calendar)
router.get('/tutor/:tutorId', async (req, res) => {
  try {
    const { tutorId } = req.params;
    const { status, from, to, classId } = req.query;
    
    // Handle multiple statuses
    let statusFilter = {};
    if (status) {
      if (Array.isArray(status)) {
        // Multiple statuses provided
        statusFilter = { status: { in: status } };
      } else {
        // Single status provided
        statusFilter = { status };
      }
    }
    
    const where = {
      class: { tutorId },
      ...statusFilter,
      ...(from && { scheduledAt: { gte: new Date(from) } }),
      ...(to && { scheduledAt: { lte: new Date(to) } }),
      ...(classId && { classId }),
    };
    
    const bookings = await prisma.booking.findMany({
      where,
      select: {
        id: true,
        scheduledAt: true,
        status: true,
        classId: true,
        studentId: true,
        class: {
          select: {
            title: true,
            durationMinutes: true
          }
        },
        student: {
          select: {
            firstName: true,
            lastName: true
          }
        }
      },
      orderBy: {
        scheduledAt: 'asc'
      }
    });
    
    // Transform the data to include student name and class info
    const transformedBookings = bookings.map(booking => ({
      id: booking.id,
      scheduledAt: booking.scheduledAt,
      status: booking.status,
      classId: booking.classId,
      studentId: booking.studentId,
      studentName: `${booking.student.firstName} ${booking.student.lastName}`,
      durationMinutes: booking.class.durationMinutes,
      classTitle: booking.class.title
    }));
    
    res.json({ data: transformedBookings });
  } catch (error) {
    console.error('Error fetching tutor bookings:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get booking by ID
router.get('/:id', authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userType = req.user.userType;

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        class: {
          include: {
            tutor: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                bio: true
              }
            }
          }
        },
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // Check if user has access to this booking
    if (userType === 'STUDENT' && booking.studentId !== userId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    if (userType === 'TUTOR' && booking.class.tutorId !== userId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json({ data: booking });
  } catch (error) {
    console.error('Error fetching booking:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Create new booking (students only)
router.post('/', authenticateUser, async (req, res) => {
  try {
    const { classId, scheduledAt, notes } = req.body;
    const userId = req.user.id;

    if (!classId || !scheduledAt) {
      return res.status(400).json({ message: 'classId and scheduledAt are required' });
    }

    // Check if user is a student
    if (req.user.userType !== 'STUDENT') {
      return res.status(403).json({ message: 'Only students can create bookings' });
    }

    // Check if class exists and is active
    const classData = await prisma.class.findUnique({
      where: { id: classId }
    });

    if (!classData) {
      return res.status(404).json({ message: 'Class not found' });
    }

    if (!classData.isActive) {
      return res.status(400).json({ message: 'This class is not available for booking' });
    }

    // Check if the scheduled time is in the future
    const scheduledDate = new Date(scheduledAt);
    if (scheduledDate <= new Date()) {
      return res.status(400).json({ message: 'Booking must be scheduled for a future time' });
    }

    // Check for booking conflicts (same student, same time)
    const existingBooking = await prisma.booking.findFirst({
      where: {
        studentId: userId,
        scheduledAt: {
          gte: new Date(scheduledDate.getTime() - 30 * 60 * 1000), // 30 minutes before
          lte: new Date(scheduledDate.getTime() + 30 * 60 * 1000)  // 30 minutes after
        }
      }
    });

    // Check for tutor conflicts (tutor already has a booking at this time)
    const tutorConflict = await prisma.booking.findFirst({
      where: {
        class: {
          tutorId: classData.tutorId
        },
        scheduledAt: {
          gte: new Date(scheduledDate.getTime() - 30 * 60 * 1000), // 30 minutes before
          lte: new Date(scheduledDate.getTime() + 30 * 60 * 1000)  // 30 minutes after
        },
        status: {
          in: ['PENDING', 'CONFIRMED']
        }
      }
    });

    if (existingBooking) {
      return res.status(409).json({ message: 'You already have a booking at this time' });
    }

    if (tutorConflict) {
      return res.status(409).json({ message: 'The tutor is not available at this time' });
    }

    // Create the booking
    const booking = await prisma.booking.create({
      data: {
        classId,
        studentId: userId,
        tutorId: classData.tutorId, // <-- Set tutorId for permission checks
        scheduledAt: scheduledDate,
        notes: notes || '',
        status: BookingStatus.PENDING,
        totalAmount: classData.pricePerSession
      },
      include: {
        class: {
          include: {
            tutor: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true
              }
            }
          }
        },
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    res.status(201).json({ data: booking });
  } catch (error) {
    console.error('Error creating booking:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PATCH /api/bookings/:id/status
router.patch('/:id/status', authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const userId = req.user.id;
    const userType = req.user.userType;

    if (!status) {
      return res.status(400).json({ message: 'Status is required' });
    }

    // Find the booking
    const booking = await prisma.booking.findUnique({ where: { id } });
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // Only the tutor or the student who owns the booking can update status
    if (userType === 'TUTOR') {
      // Tutor can confirm or cancel
      if (status !== 'CONFIRMED' && status !== 'CANCELLED') {
        return res.status(400).json({ message: 'Tutors can only set status to CONFIRMED or CANCELLED' });
      }
      if (booking.tutorId !== userId) {
        return res.status(403).json({ message: 'You do not have permission to update this booking' });
      }
    } else if (userType === 'STUDENT') {
      // Student can cancel their own booking (any status)
      if (status !== 'CANCELLED') {
        return res.status(400).json({ message: 'Students can only set status to CANCELLED' });
      }
      if (booking.studentId !== userId) {
        return res.status(403).json({ message: 'You do not have permission to cancel this booking' });
      }
    } else {
      return res.status(403).json({ message: 'Invalid user type' });
    }

    // Update the booking status
    const updated = await prisma.booking.update({
      where: { id },
      data: { status }
    });
    return res.status(200).json({ success: true, data: updated });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// DELETE /api/bookings/:id
// Allow students to delete their own bookings regardless of status
router.delete('/:id', authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const booking = await prisma.booking.findUnique({
      where: { id }
    });

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // Only students can delete their own bookings
    if (req.user.userType !== 'STUDENT' || booking.studentId !== userId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    await prisma.booking.delete({
      where: { id }
    });

    res.json({ message: 'Booking cancelled successfully' });
  } catch (error) {
    console.error('Error deleting booking:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Zod schema for reschedule request
const rescheduleSchema = z.object({
  proposedTime: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Invalid date format',
  })
});

// POST /api/bookings/:id/reschedule - Propose a reschedule
router.post('/:id/reschedule', authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;
    const { proposedTime } = req.body;
    const userId = req.user.id;

    // Validate input
    const parse = rescheduleSchema.safeParse({ proposedTime });
    if (!parse.success) {
      return res.status(400).json({ errors: parse.error.errors });
    }

    // Check booking exists and user is participant
    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { student: true, class: { include: { tutor: true } } }
    });
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    if (booking.studentId !== userId && booking.class.tutorId !== userId) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Create reschedule request
    const request = await prisma.rescheduleRequest.create({
      data: {
        bookingId: id,
        requestedById: userId,
        proposedTime: new Date(proposedTime),
        status: 'PENDING'
      }
    });
    return res.status(201).json({ data: request });
  } catch (error) {
    console.error('Reschedule propose error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/bookings/:id/reschedule/:requestId/accept - Accept reschedule
router.post('/:id/reschedule/:requestId/accept', authenticateUser, async (req, res) => {
  try {
    const { id, requestId } = req.params;
    const userId = req.user.id;

    // Find reschedule request and include booking.class
    const request = await prisma.rescheduleRequest.findUnique({
      where: { id: requestId },
      include: { booking: { include: { class: true } } }
    });
    if (!request || request.bookingId !== id) return res.status(404).json({ message: 'Request not found' });
    if (request.status !== 'PENDING') return res.status(400).json({ message: 'Request already handled' });

    // Only the other party can accept
    const booking = request.booking;
    if (request.requestedById === booking.studentId && userId !== booking.class.tutorId) {
      return res.status(403).json({ message: 'Only tutor can accept' });
    }
    if (request.requestedById === booking.class.tutorId && userId !== booking.studentId) {
      return res.status(403).json({ message: 'Only student can accept' });
    }

    // Update booking time and request status
    await prisma.$transaction([
      prisma.rescheduleRequest.update({ where: { id: requestId }, data: { status: 'ACCEPTED' } }),
      prisma.booking.update({ where: { id }, data: { scheduledAt: request.proposedTime } })
    ]);
    return res.status(200).json({ message: 'Reschedule accepted', newTime: request.proposedTime });
  } catch (error) {
    console.error('Reschedule accept error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/bookings/:id/reschedule/:requestId/decline - Decline reschedule
router.post('/:id/reschedule/:requestId/decline', authenticateUser, async (req, res) => {
  try {
    const { id, requestId } = req.params;
    const userId = req.user.id;

    // Find reschedule request and include booking.class
    const request = await prisma.rescheduleRequest.findUnique({
      where: { id: requestId },
      include: { booking: { include: { class: true } } }
    });
    if (!request || request.bookingId !== id) return res.status(404).json({ message: 'Request not found' });
    if (request.status !== 'PENDING') return res.status(400).json({ message: 'Request already handled' });

    // Only the other party can decline
    const booking = request.booking;
    if (request.requestedById === booking.studentId && userId !== booking.class.tutorId) {
      return res.status(403).json({ message: 'Only tutor can decline' });
    }
    if (request.requestedById === booking.class.tutorId && userId !== booking.studentId) {
      return res.status(403).json({ message: 'Only student can decline' });
    }

    await prisma.rescheduleRequest.update({ where: { id: requestId }, data: { status: 'DECLINED' } });
    return res.status(200).json({ message: 'Reschedule declined' });
  } catch (error) {
    console.error('Reschedule decline error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/reschedule-requests - Get all reschedule requests for the current user
router.get('/reschedule-requests', authenticateUser, async (req, res) => {
  try {
    const userId = req.user.id;
    const userType = req.user.userType;
    // Fetch requests where user is either the booking's tutor or student, or the requester
    const requests = await prisma.rescheduleRequest.findMany({
      where: {
        OR: [
          { requestedById: userId },
          { booking: { studentId: userId } },
          { booking: { class: { tutorId: userId } } }
        ]
      },
      include: {
        booking: {
          include: {
            class: {
              select: { id: true, title: true, subject: true, tutorId: true }
            },
            student: { select: { id: true, firstName: true, lastName: true, email: true } }
          }
        },
        requestedBy: { select: { id: true, firstName: true, lastName: true, email: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    console.log('Reschedule requests returned to frontend:', JSON.stringify(requests, null, 2));
    res.json({ data: requests });
  } catch (error) {
    console.error('Error fetching reschedule requests:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/bookings/:id/reschedule - Get all reschedule requests for a specific booking
router.get('/:id/reschedule', authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    // Only allow if user is participant
    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { class: true }
    });
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    if (booking.studentId !== userId && booking.class.tutorId !== userId) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    const requests = await prisma.rescheduleRequest.findMany({
      where: { bookingId: id },
      orderBy: { createdAt: 'desc' },
      include: {
        requestedBy: { select: { id: true, firstName: true, lastName: true, email: true } }
      }
    });
    res.json({ data: requests });
  } catch (error) {
    console.error('Error fetching reschedule requests for booking:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router; 