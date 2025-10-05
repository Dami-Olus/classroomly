const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
const supabase = require('../lib/supabase'); // Correct supabase client



// Middleware to verify JWT token
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ message: 'Access token required' });

  try {
    const user = jwt.verify(token, process.env.JWT_SECRET);
    req.user = user;
    next();
  } catch (err) {
    return res.status(403).json({ message: 'Invalid or expired token' });
  }
};


// Helper to fetch a session by ID with related booking, class, tutor, student
const getSessionById = async (id) => {
  const { data: session, error } = await supabase
    .from('sessions')
    .select(`
      *,
      booking:bookings(
        *,
        class:classes(
          *,
          tutor:tutors(*)
        ),
        student:users(*)
      )
    `)
    .eq('id', id)
    .single();

  if (error) throw error;
  return session;
};

// Get all sessions for authenticated user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { user } = req;
    const { status } = req.query;

    let query = supabase
      .from('sessions')
      .select(`
        *,
        booking:bookings (
          *,
          class:classes (
            *,
            tutor:users!classes_tutor_id_fkey (
              id,
              first_name,
              last_name,
              email
            )
          ),
          student:users!bookings_student_id_fkey (
            id,
            first_name,
            last_name,
            email
          )
        )
      `)
      .order('created_at', { ascending: false });

    // Filter by user type
    if (user.userType === 'TUTOR') {
      // Get sessions where user is the tutor
      const { data: sessions, error } = await query;
      if (error) throw error;
      
      const tutorSessions = sessions.filter(
        s => s.booking?.class?.tutor?.id === user.id
      );
      
      const formattedSessions = tutorSessions.map(session => ({
        id: session.id,
        bookingId: session.booking_id,
        classId: session.booking.class_id,
        tutorId: session.booking.class.tutor.id,
        studentId: session.booking.student.id,
        startTime: session.booking.scheduled_at,
        endTime: new Date(
          new Date(session.booking.scheduled_at).getTime() + 
          session.booking.class.duration_minutes * 60000
        ),
        status: session.status,
        class: session.booking.class,
        tutor: session.booking.class.tutor,
        student: session.booking.student
      }));
      
      return res.json({ data: formattedSessions });
    } else if (user.userType === 'STUDENT') {
      // Get sessions where user is the student
      const { data: sessions, error } = await query;
      if (error) throw error;
      
      const studentSessions = sessions.filter(
        s => s.booking?.student?.id === user.id
      );
      
      const formattedSessions = studentSessions.map(session => ({
        id: session.id,
        bookingId: session.booking_id,
        classId: session.booking.class_id,
        tutorId: session.booking.class.tutor.id,
        studentId: session.booking.student.id,
        startTime: session.booking.scheduled_at,
        endTime: new Date(
          new Date(session.booking.scheduled_at).getTime() + 
          session.booking.class.duration_minutes * 60000
        ),
        status: session.status,
        class: session.booking.class,
        tutor: session.booking.class.tutor,
        student: session.booking.student
      }));
      
      return res.json({ data: formattedSessions });
    }

    res.json({ data: [] });
  } catch (error) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get session by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { user } = req;

    const session = await getSessionById(id);
    if (!session) return res.status(404).json({ message: 'Session not found' });

    const isAuthorized =
      (user.userType === 'TUTOR' && session.booking.class.tutor.id === user.id) ||
      (user.userType === 'STUDENT' && session.booking.student.id === user.id);

    if (!isAuthorized) return res.status(403).json({ message: 'Not authorized' });

    const sessionData = {
      id: session.id,
      bookingId: session.bookingId,
      classId: session.booking.classId,
      tutorId: session.booking.class.tutor.id,
      studentId: session.booking.student.id,
      startTime: session.booking.scheduledAt,
      endTime: new Date(new Date(session.booking.scheduledAt).getTime() + session.booking.class.durationMinutes * 60000),
      status: session.status,
      class: session.booking.class,
      tutor: session.booking.class.tutor,
      student: session.booking.student
    };

    res.json({ data: sessionData });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Start session (tutor only)
router.post('/:id/start', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { user } = req;

    if (user.userType !== 'TUTOR') return res.status(403).json({ message: 'Only tutors can start sessions' });

    const session = await getSessionById(id);
    if (!session) return res.status(404).json({ message: 'Session not found' });

    if (session.booking.class.tutor.id !== user.id) return res.status(403).json({ message: 'You can only start your own sessions' });
    if (session.status !== 'SCHEDULED') return res.status(400).json({ message: 'Session cannot be started in its current state' });

    // Update session
    const { data: updatedSession, error } = await supabase
      .from('sessions')
      .update({ status: 'IN_PROGRESS', startedAt: new Date() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;

    // Update booking status
    await supabase.from('bookings').update({ status: 'COMPLETED' }).eq('id', session.bookingId);

    res.json({ message: 'Session started successfully', data: updatedSession });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Join session (student only)
router.post('/:id/join', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { user } = req;

    if (user.userType !== 'STUDENT') return res.status(403).json({ message: 'Only students can join sessions' });

    const session = await getSessionById(id);
    if (!session) return res.status(404).json({ message: 'Session not found' });

    if (session.booking.student.id !== user.id) return res.status(403).json({ message: 'You can only join your own sessions' });
    if (session.status !== 'IN_PROGRESS') return res.status(400).json({ message: 'Session is not currently in progress' });

    res.json({ message: 'Successfully joined session', data: session });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// End session (tutor only)
router.post('/:id/end', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { user } = req;

    if (user.userType !== 'TUTOR') return res.status(403).json({ message: 'Only tutors can end sessions' });

    const session = await getSessionById(id);
    if (!session) return res.status(404).json({ message: 'Session not found' });

    if (session.booking.class.tutor.id !== user.id) return res.status(403).json({ message: 'You can only end your own sessions' });
    if (session.status !== 'IN_PROGRESS') return res.status(400).json({ message: 'Session is not currently in progress' });

    const { data: updatedSession, error } = await supabase
      .from('sessions')
      .update({ status: 'COMPLETED', endedAt: new Date() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;

    await supabase.from('bookings').update({ status: 'COMPLETED' }).eq('id', session.bookingId);

    res.json({ message: 'Session ended successfully', data: updatedSession });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// TODO: Other endpoints like restart, list sessions, by booking, create session
// can follow the same pattern: use `supabase.from(...).select()`, update(), insert(), etc.

module.exports = router;
