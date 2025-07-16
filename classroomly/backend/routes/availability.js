const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateUser } = require('../middleware/auth');
const { z } = require('zod');

const router = express.Router();
const prisma = new PrismaClient();

const availabilitySchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^[0-9]{2}:[0-9]{2}$/),
  endTime: z.string().regex(/^[0-9]{2}:[0-9]{2}$/),
  timezone: z.string().min(1),
  bufferMinutes: z.number().int().min(0).max(120).optional()
});

// Get all availability slots for a tutor
router.get('/:tutorId', async (req, res) => {
  try {
    const { tutorId } = req.params;
    const slots = await prisma.availability.findMany({
      where: { tutorId },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }]
    });
    // Get bufferMinutes from the first slot (if set), or default to 0
    const bufferMinutes = slots.length > 0 ? slots[0].bufferMinutes || 0 : 0;
    res.json({ data: slots, bufferMinutes });
  } catch (error) {
    console.error('Error fetching availability:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get availability with booking conflicts for a tutor
router.get('/:tutorId/with-conflicts', async (req, res) => {
  try {
    const { tutorId } = req.params;
    const { date, durationMinutes = 60 } = req.query;

    // Get tutor's availability slots
    const slots = await prisma.availability.findMany({
      where: { tutorId },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }]
    });

    // Get bufferMinutes from the first slot (if set), or default to 0
    const bufferMinutes = slots.length > 0 ? slots[0].bufferMinutes || 0 : 0;

    // If a specific date is requested, also fetch bookings for that date
    let bookings = [];
    if (date) {
      const requestedDate = new Date(date);
      const startOfDay = new Date(requestedDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(requestedDate);
      endOfDay.setHours(23, 59, 59, 999);

      // Fetch both PENDING and CONFIRMED bookings for the tutor on this date
      bookings = await prisma.booking.findMany({
        where: {
          class: {
            tutorId: tutorId
          },
          scheduledAt: {
            gte: startOfDay,
            lte: endOfDay
          },
          status: {
            in: ['PENDING', 'CONFIRMED']
          }
        },
        include: {
          class: {
            select: {
              durationMinutes: true
            }
          },
          student: {
            select: {
              firstName: true,
              lastName: true
            }
          }
        },
        orderBy: {
          scheduledAt: 'asc'
        }
      });
    }

    res.json({ 
      data: slots, 
      bufferMinutes,
      bookings: bookings,
      conflicts: bookings.map(booking => ({
        id: booking.id,
        scheduledAt: booking.scheduledAt,
        status: booking.status,
        durationMinutes: booking.class.durationMinutes,
        studentName: `${booking.student.firstName} ${booking.student.lastName}`,
        classTitle: booking.class.title || 'Class'
      }))
    });
  } catch (error) {
    console.error('Error fetching availability with conflicts:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Add a new availability slot (tutor only)
router.post('/:tutorId', authenticateUser, async (req, res) => {
  try {
    const { tutorId } = req.params;
    const parseResult = availabilitySchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ message: 'Invalid input', errors: parseResult.error.errors });
    }
    const { dayOfWeek, startTime, endTime, timezone, bufferMinutes } = parseResult.data;
    if (req.user.id !== tutorId || req.user.userType !== 'TUTOR') {
      return res.status(403).json({ message: 'Only the tutor can add their own availability.' });
    }
    const slot = await prisma.availability.create({
      data: { tutorId, dayOfWeek, startTime, endTime, timezone, bufferMinutes }
    });
    res.status(201).json({ data: slot });
  } catch (error) {
    console.error('Error adding availability:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update an availability slot (tutor only)
router.put('/:tutorId/:slotId', authenticateUser, async (req, res) => {
  try {
    const { tutorId, slotId } = req.params;
    const parseResult = availabilitySchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ message: 'Invalid input', errors: parseResult.error.errors });
    }
    const { dayOfWeek, startTime, endTime, timezone, bufferMinutes } = parseResult.data;
    if (req.user.id !== tutorId || req.user.userType !== 'TUTOR') {
      return res.status(403).json({ message: 'Only the tutor can update their own availability.' });
    }
    const slot = await prisma.availability.update({
      where: { id: slotId },
      data: { dayOfWeek, startTime, endTime, timezone, bufferMinutes }
    });
    res.json({ data: slot });
  } catch (error) {
    console.error('Error updating availability:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Delete an availability slot (tutor only)
router.delete('/:tutorId/:slotId', authenticateUser, async (req, res) => {
  try {
    const { tutorId, slotId } = req.params;
    if (req.user.id !== tutorId || req.user.userType !== 'TUTOR') {
      return res.status(403).json({ message: 'Only the tutor can delete their own availability.' });
    }
    await prisma.availability.delete({ where: { id: slotId } });
    res.json({ message: 'Availability slot deleted.' });
  } catch (error) {
    console.error('Error deleting availability:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router; 