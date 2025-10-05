const express = require('express');
const jwt = require('jsonwebtoken');
const supabase = require('../lib/supabase');

const router = express.Router();

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Access token required' });
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: 'Invalid or expired token' });
    req.user = user;
    next();
  });
};

// Helper: check if user is participant in class or session
async function isParticipant(user, classId, sessionId) {
  if (user.userType === 'TUTOR' && classId) {
    const { data: cls, error } = await supabase
      .from('class')
      .select('tutorId')
      .eq('id', classId)
      .single();

    if (error) throw error;
    if (cls && cls.tutorId === user.id) return true;
  } else if (user.userType === 'STUDENT') {
    if (sessionId) {
      const { data: session, error } = await supabase
        .from('session')
        .select('id, booking!inner(studentId)')
        .eq('id', sessionId)
        .single();

      if (error) throw error;
      if (session && session.booking.studentId === user.id) return true;
    } else if (classId) {
      const { data: booking, error } = await supabase
        .from('booking')
        .select('id')
        .eq('classId', classId)
        .eq('studentId', user.id)
        .maybeSingle();

      if (error) throw error;
      if (booking) return true;
    }
  }
  return false;
}

// -----------------------------
// POST /api/messages - send message
// -----------------------------
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { classId, sessionId, message } = req.body;
    const { user } = req;

    if (!classId && !sessionId) return res.status(400).json({ message: 'classId or sessionId required' });
    if (!message) return res.status(400).json({ message: 'Message required' });

    const authorized = await isParticipant(user, classId, sessionId);
    if (!authorized) return res.status(403).json({ message: 'Not authorized' });

    const { data: msg, error } = await supabase
      .from('message')
      .insert([{
        classId,
        sessionId,
        senderId: user.id,
        senderType: user.userType,
        content: message
      }])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ data: msg });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// -----------------------------
// GET /api/messages?classId=...&sessionId=... - fetch messages
// -----------------------------
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { classId, sessionId } = req.query;
    const { user } = req;

    if (!classId && !sessionId) {
      return res.status(400).json({ message: 'classId or sessionId required' });
    }

    const authorized = await isParticipant(user, classId, sessionId);
    if (!authorized) return res.status(403).json({ message: 'Not authorized' });

    const where = sessionId ? { sessionId } : { classId };

    const { data: messages, error } = await supabase
      .from('message')
      .select('*')
      .match(where)
      .order('createdAt', { ascending: true });

    if (error) throw error;

    res.json({ data: messages });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
