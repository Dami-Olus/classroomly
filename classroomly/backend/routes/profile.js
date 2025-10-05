const express = require('express');
const { z } = require('zod');
const supabase = require('../lib/supabase'); // Correct supabase client
const { authenticateUser } = require('../middleware/auth');
const { validateBody } = require('../middleware/validation');

const router = express.Router();

// Schema for updating profile
const updateProfileSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  avatarUrl: z.string().url().optional(),
  bio: z.string().max(1000).optional(),
  hourlyRate: z.number().positive().optional(),
  subjects: z.array(z.string()).optional(),
  timezone: z.string().max(50).optional()
});

// GET /api/profile - Get current user's profile
router.get('/', authenticateUser, async (req, res) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, first_name, last_name, user_type, avatar_url, bio, hourly_rate, subjects, timezone, is_verified, is_active, created_at, updated_at')
      .eq('id', req.user.id)
      .single();

    if (error) throw error;
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    return res.status(200).json({ success: true, data: user });
  } catch (error) {
    console.error('Profile fetch error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch profile' });
  }
});

// PUT /api/profile - Update current user's profile
router.put('/', authenticateUser, validateBody(updateProfileSchema), async (req, res) => {
  try {
    const updateData = { ...req.validatedBody };

    // Prevent updating email or userType
    delete updateData.email;
    delete updateData.userType;

    // Only allow tutors to update hourlyRate and subjects
    if (("hourlyRate" in updateData || "subjects" in updateData) && req.user.userType !== "TUTOR") {
      return res.status(403).json({ success: false, message: 'Only tutors can update hourly rate and subjects' });
    }

    // Convert subjects array to string if needed
    if (updateData.subjects && Array.isArray(updateData.subjects)) {
      updateData.subjects = updateData.subjects.join(',');
    }

    const { data: updated, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', req.user.id)
      .select('id, email, first_name, last_name, user_type, avatar_url, bio, hourly_rate, subjects, timezone, is_verified, is_active, created_at, updated_at')
      .single();

    if (error) throw error;

    return res.status(200).json({ success: true, message: 'Profile updated', data: updated });
  } catch (error) {
    console.error('Profile update error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update profile' });
  }
});

module.exports = router;
