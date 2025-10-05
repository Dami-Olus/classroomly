const express = require('express');
const { authenticateUser } = require('../middleware/auth');
const { z } = require('zod');
const supabase = require('../lib/supabase');

const router = express.Router();

const availabilitySchema = z.object({
  day_of_week: z.number().int().min(0).max(6),
  start_time: z.string().regex(/^[0-9]{2}:[0-9]{2}$/),
  end_time: z.string().regex(/^[0-9]{2}:[0-9]{2}$/),
  timezone: z.string().min(1),
  buffer_minutes: z.number().int().min(0).max(120).optional()
});

// -----------------------------------------------------------------------------
// GET /:tutorId - Get all availability slots for a tutor
// -----------------------------------------------------------------------------
router.get('/:tutorId', async (req, res) => {
  try {
    const { tutorId } = req.params;
    const { data: slots, error } = await supabase
      .from('availability')
      .select('*')
      .eq('tutor_id', tutorId)
      .order('day_of_week', { ascending: true })
      .order('start_time', { ascending: true });

    if (error) throw error;

    const bufferMinutes = slots.length > 0 ? slots[0].buffer_minutes || 0 : 0;
    res.json({ data: slots, bufferMinutes });
  } catch (error) {
    console.error('Error fetching availability:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// -----------------------------------------------------------------------------
// GET /:tutorId/with-conflicts - Get availability + booking conflicts
// -----------------------------------------------------------------------------
router.get('/:tutorId/with-conflicts', async (req, res) => {
  try {
    const { tutorId } = req.params;
    const { date } = req.query;

    // 1. Get tutor's availability slots
    const { data: slots, error: slotError } = await supabase
      .from('availability')
      .select('*')
      .eq('tutor_id', tutorId)
      .order('day_of_week', { ascending: true })
      .order('start_time', { ascending: true });

    if (slotError) throw slotError;
    const bufferMinutes = slots.length > 0 ? slots[0].buffer_minutes || 0 : 0;

    // 2. Get bookings for that date (if provided)
    let bookings = [];
    if (date) {
      const requestedDate = new Date(date);
      const startOfDay = new Date(requestedDate.setHours(0, 0, 0, 0)).toISOString();
      const endOfDay = new Date(requestedDate.setHours(23, 59, 59, 999)).toISOString();

      const { data, error } = await supabase
        .from('bookings')
        .select(`
          id,
          scheduled_at,
          status,
          class:classes (
            id, title, duration_minutes, tutor_id
          ),
          student:users (
            id, first_name, last_name
          )
        `)
        .gte('scheduled_at', startOfDay)
        .lte('scheduled_at', endOfDay)
        .in('status', ['PENDING', 'CONFIRMED'])
        .eq('class.tutor_id', tutorId)
        .order('scheduled_at', { ascending: true });

      if (error) throw error;
      bookings = data;
    }

    res.json({
      data: slots,
      bufferMinutes,
      bookings,
      conflicts: bookings.map(b => ({
        id: b.id,
        scheduledAt: b.scheduled_at,
        status: b.status,
        durationMinutes: b.class.duration_minutes,
        studentName: `${b.student.first_name} ${b.student.last_name}`,
        classTitle: b.class.title || 'Class'
      }))
    });
  } catch (error) {
    console.error('Error fetching availability with conflicts:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// -----------------------------------------------------------------------------
// POST /:tutorId - Add new availability slot
// -----------------------------------------------------------------------------
router.post('/:tutorId', authenticateUser, async (req, res) => {
  try {
    const { tutorId } = req.params;
    const parseResult = availabilitySchema.safeParse(req.body);

    if (!parseResult.success) {
      return res.status(400).json({ message: 'Invalid input', errors: parseResult.error.errors });
    }

    const { day_of_week, start_time, end_time, timezone, buffer_minutes } = parseResult.data;

    if (req.user.id !== tutorId || req.user.userType !== 'TUTOR') {
      return res.status(403).json({ message: 'Only the tutor can add their own availability.' });
    }

    const { data, error } = await supabase
      .from('availability')
      .insert([{ tutor_id: tutorId, day_of_week, start_time, end_time, timezone, buffer_minutes }])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ data });
  } catch (error) {
    console.error('Error adding availability:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// -----------------------------------------------------------------------------
// PUT /:tutorId/:slotId - Update availability slot
// -----------------------------------------------------------------------------
router.put('/:tutorId/:slotId', authenticateUser, async (req, res) => {
  try {
    const { tutorId, slotId } = req.params;
    const parseResult = availabilitySchema.safeParse(req.body);

    if (!parseResult.success) {
      return res.status(400).json({ message: 'Invalid input', errors: parseResult.error.errors });
    }

    const { day_of_week, start_time, end_time, timezone, buffer_minutes } = parseResult.data;

    if (req.user.id !== tutorId || req.user.userType !== 'TUTOR') {
      return res.status(403).json({ message: 'Only the tutor can update their own availability.' });
    }

    const { data, error } = await supabase
      .from('availability')
      .update({ day_of_week, start_time, end_time, timezone, buffer_minutes })
      .eq('id', slotId)
      .select()
      .single();

    if (error) throw error;

    res.json({ data });
  } catch (error) {
    console.error('Error updating availability:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// -----------------------------------------------------------------------------
// DELETE /:tutorId/:slotId - Delete availability slot
// -----------------------------------------------------------------------------
router.delete('/:tutorId/:slotId', authenticateUser, async (req, res) => {
  try {
    const { tutorId, slotId } = req.params;

    if (req.user.id !== tutorId || req.user.userType !== 'TUTOR') {
      return res.status(403).json({ message: 'Only the tutor can delete their own availability.' });
    }

    const { error } = await supabase
      .from('availability')
      .delete()
      .eq('id', slotId);

    if (error) throw error;

    res.json({ message: 'Availability slot deleted.' });
  } catch (error) {
    console.error('Error deleting availability:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
