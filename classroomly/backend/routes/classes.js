const express = require('express');
const { z } = require('zod');
const prisma = require('../lib/prisma');
const { validateBody } = require('../middleware/validation');
const { authenticateUser, requireTutor } = require('../middleware/auth');

const router = express.Router();

// Validation schema for creating a new class
const createClassSchema = z.object({
  title: z.string()
    .min(1, 'Title is required')
    .max(255, 'Title must be less than 255 characters'),
  description: z.string()
    .max(1000, 'Description must be less than 1000 characters')
    .optional(),
  subject: z.string()
    .min(1, 'Subject is required')
    .max(100, 'Subject must be less than 100 characters'),
  level: z.enum(['beginner', 'intermediate', 'advanced'])
    .optional(),
  maxStudents: z.number()
    .int()
    .min(1, 'Maximum students must be at least 1')
    .max(50, 'Maximum students cannot exceed 50')
    .default(1),
  durationMinutes: z.number()
    .int()
    .min(15, 'Duration must be at least 15 minutes')
    .max(480, 'Duration cannot exceed 8 hours (480 minutes)'),
  pricePerSession: z.number()
    .positive('Price must be positive')
    .max(1000, 'Price cannot exceed $1000 per session')
});

// Add updateClassSchema for updates (all fields optional)
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
 * Create a new tutoring class
 * Requires: Authentication, Tutor role
 */
router.post('/', 
  authenticateUser, 
  requireTutor, 
  validateBody(createClassSchema),
  async (req, res) => {
    try {
      const {
        title,
        description,
        subject,
        level,
        maxStudents,
        durationMinutes,
        pricePerSession
      } = req.validatedBody;

      const tutorId = req.user.id;

      // Create the new class
      const newClass = await prisma.class.create({
        data: {
          tutorId,
          title,
          description,
          subject,
          level,
          maxStudents,
          durationMinutes,
          pricePerSession: pricePerSession !== undefined ? pricePerSession : 0,
          isActive: true
        },
        include: {
          tutor: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          }
        }
      });

      // Return success response
      return res.status(201).json({
        success: true,
        message: 'Class created successfully',
        data: {
          id: newClass.id,
          title: newClass.title,
          description: newClass.description,
          subject: newClass.subject,
          level: newClass.level,
          maxStudents: newClass.maxStudents,
          durationMinutes: newClass.durationMinutes,
          pricePerSession: newClass.pricePerSession,
          isActive: newClass.isActive,
          createdAt: newClass.createdAt,
          tutor: newClass.tutor
        }
      });

    } catch (error) {
      console.error('Error creating class:', error);

      // Handle Prisma-specific errors
      if (error.code === 'P2002') {
        return res.status(409).json({
          success: false,
          message: 'A class with this title already exists'
        });
      }

      if (error.code === 'P2003') {
        return res.status(400).json({
          success: false,
          message: 'Invalid tutor reference'
        });
      }

      // Handle validation errors
      if (error.name === 'PrismaClientValidationError') {
        return res.status(400).json({
          success: false,
          message: 'Invalid data provided',
          errors: error.message
        });
      }

      // Handle database connection errors
      if (error.code === 'P1001' || error.code === 'P1008') {
        return res.status(503).json({
          success: false,
          message: 'Database connection error. Please try again later.'
        });
      }

      // Generic error response
      return res.status(500).json({
        success: false,
        message: 'Failed to create class. Please try again later.'
      });
    }
  }
);

/**
 * GET /api/classes
 * Get all classes (with optional filtering)
 * Students: only classes they are enrolled in or invited to
 * Tutors: only their own classes
 * Admins: all classes
 */
router.get('/', authenticateUser, async (req, res) => {
  try {
    const { subject, level, tutorId, isActive } = req.query;
    const user = req.user;
    let classes = [];

    if (user.userType === 'STUDENT') {
      // Find classes where the student is enrolled
      const enrolledClassIds = await prisma.enrollment.findMany({
        where: { studentId: user.id },
        select: { classId: true }
      });
      // Find classes where the student has a valid invitation (booking link)
      const invitedClassIds = await prisma.bookingLink.findMany({
        where: { isActive: true }, // Optionally add more logic for user-specific invitations
        select: { classId: true }
      });
      const classIds = [
        ...new Set([
          ...enrolledClassIds.map(e => e.classId),
          ...invitedClassIds.map(i => i.classId)
        ])
      ];
      // Build filter object
      const where = { id: { in: classIds } };
      if (subject) where.subject = { contains: subject, mode: 'insensitive' };
      if (level) where.level = level;
      if (tutorId) where.tutorId = tutorId;
      if (isActive !== undefined) where.isActive = isActive === 'true';
      classes = await prisma.class.findMany({
        where,
        include: {
          tutor: { select: { id: true, firstName: true, lastName: true, email: true } }
        },
        orderBy: { createdAt: 'desc' }
      });
    } else if (user.userType === 'TUTOR') {
      // Show only classes created by this tutor
      const where = { tutorId: user.id };
      if (subject) where.subject = { contains: subject, mode: 'insensitive' };
      if (level) where.level = level;
      if (isActive !== undefined) where.isActive = isActive === 'true';
      classes = await prisma.class.findMany({
        where,
        include: {
          tutor: { select: { id: true, firstName: true, lastName: true, email: true } }
        },
        orderBy: { createdAt: 'desc' }
      });
    } else {
      // Admin or other roles: show all classes
      const where = {};
      if (subject) where.subject = { contains: subject, mode: 'insensitive' };
      if (level) where.level = level;
      if (tutorId) where.tutorId = tutorId;
      if (isActive !== undefined) where.isActive = isActive === 'true';
      classes = await prisma.class.findMany({
        where,
        include: {
          tutor: { select: { id: true, firstName: true, lastName: true, email: true } }
        },
        orderBy: { createdAt: 'desc' }
      });
    }
    return res.status(200).json({
      success: true,
      data: classes.map(cls => ({
        ...cls,
        pricePerSession: cls.pricePerSession
      }))
    });
  } catch (error) {
    console.error('Error fetching classes:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch classes'
    });
  }
});

/**
 * GET /api/classes/:id
 * Get a specific class by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const classData = await prisma.class.findUnique({
      where: { id },
      include: {
        tutor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            bio: true,
            subjects: true,
            hourlyRate: true
          }
        }
      }
    });

    if (!classData) {
      return res.status(404).json({
        success: false,
        message: 'Class not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        ...classData,
        pricePerSession: parseFloat(classData.pricePerSession),
        tutor: {
          ...classData.tutor,
          hourlyRate: classData.tutor.hourlyRate ? parseFloat(classData.tutor.hourlyRate) : null
        }
      }
    });

  } catch (error) {
    console.error('Error fetching class:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch class'
    });
  }
});

/**
 * PUT /api/classes/:id
 * Update a class (tutor who owns the class only)
 */
router.put('/:id', authenticateUser, validateBody(updateClassSchema), async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, subject, level, maxStudents, durationMinutes, pricePerSession, isActive } = req.validatedBody;
    const userId = req.user.id;

    // Check if class exists and user owns it
    const existingClass = await prisma.class.findUnique({
      where: { id }
    });

    if (!existingClass) {
      return res.status(404).json({ 
        success: false,
        message: 'Class not found' 
      });
    }

    if (existingClass.tutorId !== userId) {
      return res.status(403).json({ 
        success: false,
        message: 'You can only edit your own classes' 
      });
    }

    // Default missing fields to existing values
    const updateData = {
      title: title !== undefined ? title : existingClass.title,
      description: description !== undefined ? description : existingClass.description,
      subject: subject !== undefined ? subject : existingClass.subject,
      level: level !== undefined ? level : existingClass.level,
      maxStudents: maxStudents !== undefined ? parseInt(maxStudents) : existingClass.maxStudents,
      durationMinutes: durationMinutes !== undefined ? parseInt(durationMinutes) : existingClass.durationMinutes,
      pricePerSession: pricePerSession !== undefined ? parseFloat(pricePerSession) : existingClass.pricePerSession,
      isActive: isActive !== undefined ? isActive : existingClass.isActive
    };

    // Validate required fields
    if (!updateData.title || !updateData.subject || isNaN(updateData.maxStudents) || isNaN(updateData.durationMinutes) || isNaN(updateData.pricePerSession)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or missing required fields'
      });
    }

    const updatedClass = await prisma.class.update({
      where: { id },
      data: updateData,
      include: {
        tutor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    return res.status(200).json({
      success: true,
      data: updatedClass
    });
  } catch (error) {
    console.error('Error updating class:', error);
    if (error.name === 'PrismaClientValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid data provided',
        errors: error.message
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * DELETE /api/classes/:id
 * Delete a class (tutor who owns the class only)
 */
router.delete('/:id', authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if class exists and user owns it
    const existingClass = await prisma.class.findUnique({
      where: { id }
    });

    if (!existingClass) {
      return res.status(404).json({ 
        success: false,
        message: 'Class not found' 
      });
    }

    if (existingClass.tutorId !== userId) {
      return res.status(403).json({ 
        success: false,
        message: 'You can only delete your own classes' 
      });
    }

    await prisma.class.delete({
      where: { id }
    });

    return res.status(200).json({
      success: true,
      message: 'Class deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting class:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router; 