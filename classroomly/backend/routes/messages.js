const express = require('express');
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const router = express.Router();
const prisma = new PrismaClient();

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
    const cls = await prisma.class.findUnique({ where: { id: classId } });
    if (cls && cls.tutorId === user.id) return true;
  } else if (user.userType === 'STUDENT') {
    if (sessionId) {
      const session = await prisma.session.findUnique({ where: { id: sessionId }, include: { booking: true } });
      if (session && session.booking.studentId === user.id) return true;
    } else if (classId) {
      // Check if student has a booking for this class
      const booking = await prisma.booking.findFirst({ where: { classId, studentId: user.id } });
      if (booking) return true;
    }
  }
  return false;
}

// POST /api/messages - send message
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { classId, sessionId, message } = req.body;
    const { user } = req;
    if (!classId && !sessionId) return res.status(400).json({ message: 'classId or sessionId required' });
    if (!message) return res.status(400).json({ message: 'Message required' });
    if (!(await isParticipant(user, classId, sessionId))) return res.status(403).json({ message: 'Not authorized' });
    const msg = await prisma.message.create({
      data: {
        classId,
        sessionId,
        senderId: user.id,
        senderType: user.userType,
        content: message // Use 'content' as required by schema
      }
    });
    res.status(201).json({ data: msg });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/messages?classId=...&sessionId=... - fetch messages
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { classId, sessionId } = req.query;
    const { user } = req;
    if (!classId && !sessionId) return res.status(400).json({ message: 'classId or sessionId required' });
    if (!(await isParticipant(user, classId, sessionId))) return res.status(403).json({ message: 'Not authorized' });
    const where = sessionId ? { sessionId } : { classId };
    const messages = await prisma.message.findMany({
      where,
      orderBy: { createdAt: 'asc' }
    });
    res.json({ data: messages });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router; 