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
        .select('id, studentId')
        .eq('id', sessionId)
        .single();

      if (error) throw error;
      if (session && session.studentId === user.id) return true;
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
// POST /api/materials - upload material metadata
// -----------------------------
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { classId, sessionId, fileUrl, fileName, fileSize, fileType, title, description } = req.body;
    const { user } = req;

    if (!classId && !sessionId) return res.status(400).json({ message: 'classId or sessionId required' });
    if (!fileUrl || !fileName || !title) return res.status(400).json({ message: 'fileUrl, fileName, and title required' });

    const authorized = await isParticipant(user, classId, sessionId);
    if (!authorized) return res.status(403).json({ message: 'Not authorized' });

    const { data: material, error } = await supabase
      .from('material')
      .insert([{
        tutorId: user.id,
        classId,
        title,
        description: description || null,
        fileUrl,
        fileName,
        fileSize: fileSize || 0,
        fileType: fileType || 'application/octet-stream',
        isPublic: false
      }])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ data: material });
  } catch (error) {
    console.error('Error uploading material:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// -----------------------------
// GET /api/materials?classId=...&sessionId=... - fetch materials
// -----------------------------
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { classId, sessionId } = req.query;
    const { user } = req;

    if (!classId && !sessionId) return res.status(400).json({ message: 'classId or sessionId required' });

    const authorized = await isParticipant(user, classId, sessionId);
    if (!authorized) return res.status(403).json({ message: 'Not authorized' });

    let filterClassId = classId;

    if (sessionId) {
      // For sessions, get the classId from the session
      const { data: session, error } = await supabase
        .from('session')
        .select('classId')
        .eq('id', sessionId)
        .single();

      if (error) throw error;
      if (session) filterClassId = session.classId;
    }

    const { data: materials, error } = await supabase
      .from('material')
      .select('*')
      .eq('classId', filterClassId)
      .order('createdAt', { ascending: false });

    if (error) throw error;

    res.json({ data: materials });
  } catch (error) {
    console.error('Error fetching materials:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
