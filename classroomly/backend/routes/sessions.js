const express = require('express');
const { PrismaClient, BookingStatus, SessionStatus } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const router = express.Router();
const prisma = new PrismaClient();

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Get session by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { user } = req;

    const session = await prisma.session.findUnique({
      where: { id },
      include: {
        booking: {
          include: {
            class: {
              include: {
                tutor: true
              }
            },
            student: true
          }
        }
      }
    });

    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    console.log('Fetched session from DB:', session);

    // Check if user is authorized to access this session
    const isAuthorized = 
      (user.userType === 'TUTOR' && session.booking.class.tutorId === user.id) ||
      (user.userType === 'STUDENT' && session.booking.studentId === user.id);

    if (!isAuthorized) {
      return res.status(403).json({ message: 'You are not authorized to access this session' });
    }

    // Transform the data to match frontend expectations
    const sessionData = {
      id: session.id,
      bookingId: session.bookingId,
      classId: session.booking.classId,
      tutorId: session.booking.class.tutorId,
      studentId: session.booking.studentId,
      startTime: session.booking.scheduledAt,
      endTime: new Date(new Date(session.booking.scheduledAt).getTime() + session.booking.class.durationMinutes * 60000),
      status: session.status,
      class: session.booking.class,
      tutor: session.booking.class.tutor,
      student: session.booking.student
    };

    console.log('Transformed sessionData for frontend:', sessionData);

    res.json({ data: sessionData });
  } catch (error) {
    console.error('Error fetching session:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Start session (tutor only)
router.post('/:id/start', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { user } = req;

    if (user.userType !== 'TUTOR') {
      return res.status(403).json({ message: 'Only tutors can start sessions' });
    }

    const session = await prisma.session.findUnique({
      where: { id },
      include: {
        booking: {
          include: {
            class: {
              include: {
                tutor: true
              }
            }
          }
        }
      }
    });

    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    // Check if the tutor owns this session
    if (session.booking.class.tutorId !== user.id) {
      return res.status(403).json({ message: 'You can only start your own sessions' });
    }

    // Check if session is in a valid state to start
    if (session.status !== SessionStatus.SCHEDULED) {
      return res.status(400).json({ message: 'Session cannot be started in its current state' });
    }

    // Allow starting sessions anytime before, during, or after scheduled time
    const startTime = new Date(session.booking.scheduledAt);
    const now = new Date();
    const timeDiff = (now.getTime() - startTime.getTime()) / (1000 * 60); // minutes

    // Allow starting anytime before or after the scheduled start (no time restrictions)
    // This provides maximum flexibility for tutors and students

    // Update session status
    const updatedSession = await prisma.session.update({
      where: { id },
      data: { 
        status: SessionStatus.IN_PROGRESS,
        startedAt: new Date()
      }
    });

    // Update booking status to completed when session starts
    await prisma.booking.update({
      where: { id: session.bookingId },
      data: { status: BookingStatus.COMPLETED }
    });

    res.json({ 
      message: 'Session started successfully',
      data: updatedSession
    });
  } catch (error) {
    console.error('Error starting session:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Join session (student only)
router.post('/:id/join', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { user } = req;

    if (user.userType !== 'STUDENT') {
      return res.status(403).json({ message: 'Only students can join sessions' });
    }

    const session = await prisma.session.findUnique({
      where: { id },
      include: {
        booking: {
          include: {
            student: true
          }
        }
      }
    });

    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    // Check if the student owns this session
    if (session.booking.studentId !== user.id) {
      return res.status(403).json({ message: 'You can only join your own sessions' });
    }

    // Check if session is in progress
    if (session.status !== SessionStatus.IN_PROGRESS) {
      return res.status(400).json({ message: 'Session is not currently in progress' });
    }

    res.json({ 
      message: 'Successfully joined session',
      data: session
    });
  } catch (error) {
    console.error('Error joining session:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// End session (tutor only)
router.post('/:id/end', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { user } = req;

    if (user.userType !== 'TUTOR') {
      return res.status(403).json({ message: 'Only tutors can end sessions' });
    }

    const session = await prisma.session.findUnique({
      where: { id },
      include: {
        booking: {
          include: {
            class: {
              include: {
                tutor: true
              }
            }
          }
        }
      }
    });

    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    // Check if the tutor owns this session
    if (session.booking.class.tutorId !== user.id) {
      return res.status(403).json({ message: 'You can only end your own sessions' });
    }

    // Check if session is in progress
    if (session.status !== SessionStatus.IN_PROGRESS) {
      return res.status(400).json({ message: 'Session is not currently in progress' });
    }

    // Update session status
    const updatedSession = await prisma.session.update({
      where: { id },
      data: { 
        status: SessionStatus.COMPLETED,
        endedAt: new Date()
      }
    });

    // Update booking status
    await prisma.booking.update({
      where: { id: session.bookingId },
      data: { status: BookingStatus.COMPLETED }
    });

    res.json({ 
      message: 'Session ended successfully',
      data: updatedSession
    });
  } catch (error) {
    console.error('Error ending session:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Restart session (tutor or student)
router.post('/:id/restart', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { user } = req;

    const session = await prisma.session.findUnique({
      where: { id },
      include: {
        booking: {
          include: {
            class: true,
            student: true
          }
        }
      }
    });

    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    // Check if the user is the tutor or student for this session
    const isAuthorized =
      (user.userType === 'TUTOR' && session.booking.class.tutorId === user.id) ||
      (user.userType === 'STUDENT' && session.booking.studentId === user.id);

    if (!isAuthorized) {
      return res.status(403).json({ message: 'You are not authorized to restart this session' });
    }

    // Only allow restart if session is completed or cancelled
    if (session.status !== 'COMPLETED' && session.status !== 'CANCELLED') {
      return res.status(400).json({ message: 'Session can only be restarted if it is completed or cancelled' });
    }

    // Update session status to IN_PROGRESS and clear endedAt
    const updatedSession = await prisma.session.update({
      where: { id },
      data: {
        status: 'IN_PROGRESS',
        endedAt: null,
        startedAt: new Date()
      }
    });

    res.json({ message: 'Session restarted successfully', data: updatedSession });
  } catch (error) {
    console.error('Error restarting session:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get user's sessions (upcoming and past)
router.get('/user/sessions', authenticateToken, async (req, res) => {
  try {
    const { user } = req;
    const { status, limit = 10, offset = 0 } = req.query;

    let whereClause = {};
    
    if (user.userType === 'TUTOR') {
      whereClause.booking = {
        tutorId: user.id
      };
    } else {
      whereClause.booking = {
        studentId: user.id
      };
    }

    if (status) {
      whereClause.status = status;
    }

    const sessions = await prisma.session.findMany({
      where: whereClause,
      include: {
        booking: {
          include: {
            class: {
              select: {
                title: true,
                subject: true
              }
            },
            tutor: {
              select: {
                firstName: true,
                lastName: true
              }
            },
            student: {
              select: {
                firstName: true,
                lastName: true
              }
            }
          }
        }
      },
      orderBy: {
        booking: {
          scheduledAt: 'desc'
        }
      },
      take: parseInt(limit),
      skip: parseInt(offset)
    });

    const total = await prisma.session.count({
      where: whereClause
    });

    // Transform the data
    const sessionsData = sessions.map(session => ({
      id: session.id,
      bookingId: session.bookingId,
      classId: session.booking.classId,
      tutorId: session.booking.tutorId,
      studentId: session.booking.studentId,
      startTime: session.booking.scheduledAt,
      endTime: new Date(new Date(session.booking.scheduledAt).getTime() + session.booking.class.durationMinutes * 60000),
      status: session.status,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      class: session.booking.class,
      tutor: session.booking.tutor,
      student: session.booking.student
    }));

    res.json({ 
      data: sessionsData,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: total > parseInt(offset) + parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching user sessions:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/sessions - Get all sessions for the current user (tutor or student)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const userType = req.user.userType;

    let sessions;
    if (userType === 'TUTOR') {
      // Sessions where the user is the tutor
      sessions = await prisma.session.findMany({
        where: {
          booking: {
            class: {
              tutorId: userId
            }
          }
        },
        include: {
          booking: {
            include: {
              class: { include: { tutor: true } },
              student: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });
    } else {
      // Sessions where the user is the student
      sessions = await prisma.session.findMany({
        where: {
          booking: {
            studentId: userId
          }
        },
        include: {
          booking: {
            include: {
              class: { include: { tutor: true } },
              student: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });
    }

    // Transform sessions to match frontend expectations
    const sessionData = sessions.map(session => ({
      id: session.id,
      bookingId: session.bookingId,
      classId: session.booking.classId,
      tutorId: session.booking.class.tutorId,
      studentId: session.booking.studentId,
      startTime: session.booking.scheduledAt,
      endTime: new Date(new Date(session.booking.scheduledAt).getTime() + session.booking.class.durationMinutes * 60000),
      status: session.status,
      class: session.booking.class,
      tutor: session.booking.class.tutor,
      student: session.booking.student
    }));

    res.json({ data: sessionData });
  } catch (error) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get session by bookingId
router.get('/by-booking/:bookingId', authenticateToken, async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { user } = req;

    const session = await prisma.session.findFirst({
      where: { bookingId },
      include: {
        booking: {
          include: {
            class: { include: { tutor: true } },
            student: true
          }
        }
      }
    });

    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    // Check if user is authorized to access this session
    const isAuthorized =
      (user.userType === 'TUTOR' && session.booking.class.tutorId === user.id) ||
      (user.userType === 'STUDENT' && session.booking.studentId === user.id);

    if (!isAuthorized) {
      return res.status(403).json({ message: 'You are not authorized to access this session' });
    }

    // Transform the data to match frontend expectations
    const sessionData = {
      id: session.id,
      bookingId: session.bookingId,
      classId: session.booking.classId,
      tutorId: session.booking.class.tutorId,
      studentId: session.booking.studentId,
      startTime: session.booking.scheduledAt,
      endTime: new Date(new Date(session.booking.scheduledAt).getTime() + session.booking.class.durationMinutes * 60000),
      status: session.status,
      class: session.booking.class,
      tutor: session.booking.class.tutor,
      student: session.booking.student
    };

    res.json({ data: sessionData });
  } catch (error) {
    console.error('Error fetching session by booking:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Create a new session from a booking
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { bookingId } = req.body;
    const { user } = req;

    if (!bookingId) {
      return res.status(400).json({ message: 'Booking ID is required' });
    }

    // Get the booking with related data
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        class: {
          include: {
            tutor: true
          }
        },
        student: true
      }
    });

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // Check if user is authorized to create a session for this booking
    if (user.userType === 'TUTOR' && booking.class.tutorId !== user.id) {
      return res.status(403).json({ message: 'You can only create sessions for your own classes' });
    }

    if (user.userType === 'STUDENT' && booking.studentId !== user.id) {
      return res.status(403).json({ message: 'You can only create sessions for your own bookings' });
    }

    // Allow creating sessions for any booking status (confirmed, completed, cancelled, etc.)
    // This provides maximum flexibility for starting sessions regardless of booking status
    if (booking.status === BookingStatus.PENDING) {
      return res.status(400).json({ message: 'Cannot create sessions for pending bookings. Please confirm the booking first.' });
    }

    // Check if a session already exists for this booking
    const existingSession = await prisma.session.findFirst({
      where: { bookingId }
    });

    if (existingSession) {
      return res.status(400).json({ message: 'A session already exists for this booking' });
    }

    // Create the session
    const session = await prisma.session.create({
      data: {
        bookingId: booking.id,
        tutorId: booking.class.tutorId,
        studentId: booking.studentId,
        classId: booking.classId,
        status: SessionStatus.SCHEDULED
      },
      include: {
        booking: {
          include: {
            class: {
              include: {
                tutor: true
              }
            },
            student: true
          }
        }
      }
    });

    // Transform the data to match frontend expectations
    const sessionData = {
      id: session.id,
      bookingId: session.bookingId,
      classId: session.booking.classId,
      tutorId: session.booking.class.tutorId,
      studentId: session.booking.studentId,
      startTime: session.booking.scheduledAt,
      endTime: new Date(new Date(session.booking.scheduledAt).getTime() + booking.class.durationMinutes * 60000),
      status: session.status,
      class: session.booking.class,
      tutor: session.booking.class.tutor,
      student: session.booking.student
    };

    res.status(201).json({ 
      message: 'Session created successfully',
      data: sessionData
    });
  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router; 