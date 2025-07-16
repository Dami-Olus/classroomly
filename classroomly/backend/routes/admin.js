console.log('Admin routes loaded');
const express = require('express');
const prisma = require('../lib/prisma');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// Middleware: require admin
async function requireAdmin(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    console.log('Auth header:', authHeader);
    if (!authHeader) return res.status(401).json({ error: 'No token' });
    const token = authHeader.split(' ')[1];
    let payload;
    try {
      payload = verifyToken(token);
      console.log('Decoded JWT payload:', payload);
    } catch (err) {
      console.log('JWT verification error:', err);
      return res.status(401).json({ error: 'Invalid token' });
    }
    if (!payload?.id) {
      console.log('No id in payload');
      return res.status(401).json({ error: 'Invalid token' });
    }
    const user = await prisma.user.findUnique({ where: { id: payload.id, isActive: true } });
    console.log('User from DB:', user);
    if (!user || user.userType !== 'ADMIN') {
      console.log('User is not admin or not found');
      return res.status(403).json({ error: 'Forbidden: Admins only' });
    }
    req.user = user;
    next();
  } catch (err) {
    console.log('Unexpected error in requireAdmin:', err);
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

// GET /api/admin/metrics
router.get('/metrics', requireAdmin, async (req, res) => {
  try {
    const [totalUsers, totalTutors, totalStudents, totalClasses, totalBookings, totalRevenue] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { userType: 'TUTOR' } }),
      prisma.user.count({ where: { userType: 'STUDENT' } }),
      prisma.class.count(),
      prisma.booking.count(),
      prisma.booking.aggregate({ _sum: { totalAmount: true } })
    ]);
    res.json({
      totalUsers,
      totalTutors,
      totalStudents,
      totalClasses,
      totalBookings,
      totalRevenue: totalRevenue._sum.totalAmount || 0
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});

// GET /api/admin/users
router.get('/users', requireAdmin, async (req, res) => {
  const { search = '', page = 1, limit = 20 } = req.query;
  const skip = (Number(page) - 1) * Number(limit);
  const where = search
    ? {
        OR: [
          { email: { contains: search, mode: 'insensitive' } },
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } }
        ]
      }
    : {};
  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: Number(limit),
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        userType: true,
        isActive: true,
        isVerified: true,
        createdAt: true
      }
    }),
    prisma.user.count({ where })
  ]);
  res.json({ users, total });
});

// GET /api/admin/classes
router.get('/classes', requireAdmin, async (req, res) => {
  const { search = '', page = 1, limit = 20 } = req.query;
  const skip = (Number(page) - 1) * Number(limit);
  const where = search
    ? {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { subject: { contains: search, mode: 'insensitive' } }
        ]
      }
    : {};
  const [classes, total] = await Promise.all([
    prisma.class.findMany({
      where,
      skip,
      take: Number(limit),
      orderBy: { createdAt: 'desc' },
      include: {
        tutor: { select: { id: true, firstName: true, lastName: true, email: true } },
        enrollments: { select: { id: true } }
      }
    }),
    prisma.class.count({ where })
  ]);
  // Map classes to include enrolledCount
  const classesWithEnrolled = classes.map(cls => ({
    ...cls,
    enrolledCount: cls.enrollments.length,
    enrollments: undefined // Remove enrollments array from response
  }));
  res.json({ classes: classesWithEnrolled, total });
});

// GET /api/admin/bookings
router.get('/bookings', requireAdmin, async (req, res) => {
  const { search = '', page = 1, limit = 20 } = req.query;
  const skip = (Number(page) - 1) * Number(limit);
  const where = search
    ? {
        OR: [
          { notes: { contains: search, mode: 'insensitive' } },
        ]
      }
    : {};
  const [bookings, total] = await Promise.all([
    prisma.booking.findMany({
      where,
      skip,
      take: Number(limit),
      orderBy: { createdAt: 'desc' },
      include: {
        class: { select: { id: true, title: true } },
        student: { select: { id: true, firstName: true, lastName: true, email: true } }
      }
    }),
    prisma.booking.count({ where })
  ]);
  res.json({ bookings, total });
});

// GET /api/admin/analytics/signups
router.get('/analytics/signups', requireAdmin, async (req, res) => {
  const { interval = 'day', range = '30d' } = req.query;
  // For demo: return dummy data
  const data = Array.from({ length: 30 }, (_, i) => ({ date: `2024-07-${i+1}`, count: Math.floor(Math.random()*10+1) }));
  res.json({ data });
});

// GET /api/admin/analytics/bookings
router.get('/analytics/bookings', requireAdmin, async (req, res) => {
  const { interval = 'day', range = '30d' } = req.query;
  // For demo: return dummy data
  const data = Array.from({ length: 30 }, (_, i) => ({ date: `2024-07-${i+1}`, count: Math.floor(Math.random()*8+1) }));
  res.json({ data });
});

// GET /api/admin/analytics/revenue
router.get('/analytics/revenue', requireAdmin, async (req, res) => {
  const { interval = 'day', range = '30d' } = req.query;
  // For demo: return dummy data
  const data = Array.from({ length: 30 }, (_, i) => ({ date: `2024-07-${i+1}`, amount: Math.floor(Math.random()*200+50) }));
  res.json({ data });
});

// GET /api/admin/logs
router.get('/logs', requireAdmin, async (req, res) => {
  // For demo: return dummy logs
  const logs = Array.from({ length: 20 }, (_, i) => ({
    id: i+1,
    level: ['info','warn','error'][Math.floor(Math.random()*3)],
    message: `Log message ${i+1}`,
    createdAt: new Date(Date.now() - i*3600*1000).toISOString()
  }));
  res.json({ logs });
});

// GET/POST /api/admin/settings
let settings = { maintenanceMode: false, featureX: true };
router.get('/settings', requireAdmin, (req, res) => {
  res.json(settings);
});
router.post('/settings', requireAdmin, (req, res) => {
  settings = { ...settings, ...req.body };
  res.json(settings);
});

module.exports = router; 