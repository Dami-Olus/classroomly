const express = require('express');
const { z } = require('zod');
const supabase = require('../lib/supabase');
const { authenticateUser, requireTutor } = require('../middleware/auth');
const { validateBody } = require('../middleware/validation');

const router = express.Router();

// Validation schema for creating a new class
const createClassSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  subject: z.string().min(1).max(100),
  level: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
  maxStudents: z.number().int().min(1).max(50).default(1),
  durationMinutes: z.number().int().min(15).max(480),
  pricePerSession: z.number().positive().max(1000).optional()
});

// Update schema (all fields optional)
const updateClassSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
  subject: z.string().min(1).max(100).optional(),
  level: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
  maxStudents: z.number().int().min(1).max(50).optional(),
  durationMinutes: z.number().int().min(15).max(480).optional(),
  pricePerSession: z.number().positive().max(1000).optional(),
  isActive: z.boolean().optional()
});

/**
 * POST /api/classes
 * Create a new class (tutor only)
 */
router.post(
  '/',
  authenticateUser,
  requireTutor,
  validateBody(createClassSchema),
  async (req, res) => {
    try {
      const { title, description, subject, level, maxStudents, durationMinutes, pricePerSession } = req.validatedBody;
      const tutorId = req.user.id;

      const { data: newClass, error } = await supabase
        .from('classes')
        .insert([{
          tutor_id: tutorId,
          title,
          description,
          subject,
          level,
          max_students: maxStudents,
          duration_minutes: durationMinutes,
          price_per_session: pricePerSession ?? 0,
          is_active: true
        }])
        .select('*')
        .single();

      if (error) throw error;

      return res.status(201).json({
        success: true,
        message: 'Class created successfully',
        data: newClass
      });

    } catch (error) {
      console.error('Error creating class:', error);
      return res.status(500).json({ success: false, message: 'Failed to create class' });
    }
  }
);

/**
 * GET /api/classes
 * Get classes (students: enrolled/invited, tutors: own, admins: all)
 */
router.get('/', authenticateUser, async (req, res) => {
  try {
    const { subject, level, tutorId, isActive } = req.query;
    const user = req.user;

    let query = supabase.from('classes').select('*');

    if (user.userType === 'STUDENT') {
      // TODO: Add enrollment / invitation logic if you have those tables
      query = query.eq('is_active', true); // basic filter for now
    } else if (user.userType === 'TUTOR') {
      query = query.eq('tutor_id', user.id);
    } // admins: no tutor filter

    if (subject) query = query.ilike('subject', `%${subject}%`);
    if (level) query = query.eq('level', level);
    if (tutorId) query = query.eq('tutor_id', tutorId);
    if (isActive !== undefined) query = query.eq('is_active', isActive === 'true');

    const { data: classes, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;

    return res.status(200).json({ success: true, data: classes });
  } catch (error) {
    console.error('Error fetching classes:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch classes' });
  }
});

/**
 * GET /api/classes/:id
 * Get class by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { data: classData, error } = await supabase
      .from('classes')
      .select('*')
      .eq('id', id)
      .single();

    if (error) return res.status(404).json({ success: false, message: 'Class not found' });

    return res.status(200).json({ success: true, data: classData });
  } catch (error) {
    console.error('Error fetching class:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch class' });
  }
});

/**
 * PUT /api/classes/:id
 * Update a class (tutor who owns it)
 */
router.put('/:id', authenticateUser, requireTutor, validateBody(updateClassSchema), async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.validatedBody;

    // Check ownership
    const { data: existingClass, error: findError } = await supabase
      .from('classes')
      .select('*')
      .eq('id', id)
      .single();

    if (findError || !existingClass) return res.status(404).json({ success: false, message: 'Class not found' });
    if (existingClass.tutor_id !== req.user.id) return res.status(403).json({ success: false, message: 'You can only edit your own classes' });

    const { data: updatedClass, error: updateError } = await supabase
      .from('classes')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single();

    if (updateError) throw updateError;

    return res.status(200).json({ success: true, data: updatedClass });
  } catch (error) {
    console.error('Error updating class:', error);
    return res.status(500).json({ success: false, message: 'Failed to update class' });
  }
});

/**
 * DELETE /api/classes/:id
 * Delete a class (tutor who owns it)
 */
router.delete('/:id', authenticateUser, requireTutor, async (req, res) => {
  try {
    const { id } = req.params;

    const { data: existingClass, error: findError } = await supabase
      .from('classes')
      .select('*')
      .eq('id', id)
      .single();

    if (findError || !existingClass) return res.status(404).json({ success: false, message: 'Class not found' });
    if (existingClass.tutor_id !== req.user.id) return res.status(403).json({ success: false, message: 'You can only delete your own classes' });

    const { error: deleteError } = await supabase.from('classes').delete().eq('id', id);
    if (deleteError) throw deleteError;

    return res.status(200).json({ success: true, message: 'Class deleted successfully' });
  } catch (error) {
    console.error('Error deleting class:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete class' });
  }
});

module.exports = router;
