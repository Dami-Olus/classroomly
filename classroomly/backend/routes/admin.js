console.log('Admin routes loaded');
const express = require('express');
const supabase = require('../lib/supabase'); // your supabase client
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// Middleware: require admin
async function requireAdmin(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No token' });
    const token = authHeader.split(' ')[1];

    let payload;
    try {
      payload = verifyToken(token);
    } catch (err) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    if (!payload?.id) return res.status(401).json({ error: 'Invalid token' });

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', payload.id)
      .eq('is_active', true)
      .single();

    if (error || !user || user.user_type !== 'ADMIN') {
      return res.status(403).json({ error: 'Forbidden: Admins only' });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error('requireAdmin error:', err);
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

// GET /api/admin/users
router.get('/users', requireAdmin, async (req, res) => {
  try {
    const { search = '', page = 1, limit = 20 } = req.query;
    const from = (Number(page) - 1) * Number(limit);
    const to = from + Number(limit) - 1;

    let query = supabase.from('users').select('*', { count: 'exact' }).range(from, to).order('created_at', { ascending: false });

    if (search) {
      query = query.or(
        `email.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%`
      );
    }

    const { data: users, count, error } = await query;
    if (error) throw error;

    res.json({ users, total: count });
  } catch (err) {
    console.error('Fetch users error:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// GET /api/admin/classes
router.get('/classes', requireAdmin, async (req, res) => {
  try {
    const { search = '', page = 1, limit = 20 } = req.query;
    const from = (Number(page) - 1) * Number(limit);
    const to = from + Number(limit) - 1;

    let query = supabase
      .from('classes')
      .select(`
        *,
        tutor:users(id,first_name,last_name,email),
        enrollments(id)
      `)
      .range(from, to)
      .order('created_at', { ascending: false });

    if (search) {
      query = query.or(`title.ilike.%${search}%,subject.ilike.%${search}%`);
    }

    const { data: classes, error } = await query;
    if (error) throw error;

    const classesWithEnrolled = classes.map(cls => ({
      ...cls,
      enrolledCount: cls.enrollments?.length || 0,
      enrollments: undefined
    }));

    // Count total
    const { count: total } = await supabase
      .from('classes')
      .select('*', { count: 'exact' })
      .maybe(query?.filters); // optional: replicate filters

    res.json({ classes: classesWithEnrolled, total });
  } catch (err) {
    console.error('Fetch classes error:', err);
    res.status(500).json({ error: 'Failed to fetch classes' });
  }
});

// GET /api/admin/bookings
router.get('/bookings', requireAdmin, async (req, res) => {
  try {
    const { search = '', page = 1, limit = 20 } = req.query;
    const from = (Number(page) - 1) * Number(limit);
    const to = from + Number(limit) - 1;

    let query = supabase
      .from('bookings')
      .select(`
        *,
        class:id,title,
        student:users(id,first_name,last_name,email)
      `)
      .range(from, to)
      .order('created_at', { ascending: false });

    if (search) {
      query = query.ilike('notes', `%${search}%`);
    }

    const { data: bookings, count, error } = await query;
    if (error) throw error;

    res.json({ bookings, total: count });
  } catch (err) {
    console.error('Fetch bookings error:', err);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

module.exports = router;
