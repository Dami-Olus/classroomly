const express = require('express');
const { z } = require('zod');
const prisma = require('../lib/prisma');
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
  subjects: z.string().optional(),
  timezone: z.string().max(50).optional()
});

// GET /api/profile - Get current user's profile
router.get('/', authenticateUser, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        userType: true,
        avatarUrl: true,
        bio: true,
        hourlyRate: true,
        subjects: true,
        timezone: true,
        isVerified: true,
        isActive: true,
        createdAt: true,
        updatedAt: true
      }
    });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    return res.status(200).json({ success: true, data: user });
  } catch (error) {
    console.error('Profile fetch error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch profile' });
  }
});

// PUT /api/profile - Update current user's profile
router.put('/', authenticateUser, validateBody(updateProfileSchema), async (req, res) => {
  try {
    const updateData = req.validatedBody;
    // Prevent updating email or userType
    delete updateData.email;
    delete updateData.userType;

    // Only allow tutors to update hourlyRate and subjects
    if (("hourlyRate" in updateData || "subjects" in updateData) && req.user.userType !== "TUTOR") {
      return res.status(403).json({ success: false, message: 'Only tutors can update hourly rate and subjects' });
    }

    // Convert subjects array to string if provided as array
    if (updateData.subjects && Array.isArray(updateData.subjects)) {
      updateData.subjects = updateData.subjects.join(',');
    }

    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: updateData,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        userType: true,
        avatarUrl: true,
        bio: true,
        hourlyRate: true,
        subjects: true,
        timezone: true,
        isVerified: true,
        isActive: true,
        createdAt: true,
        updatedAt: true
      }
    });
    return res.status(200).json({ success: true, message: 'Profile updated', data: updated });
  } catch (error) {
    console.error('Profile update error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update profile' });
  }
});

module.exports = router; 