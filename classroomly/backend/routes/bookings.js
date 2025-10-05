const express = require('express');
const { authenticateUser } = require('../middleware/auth');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const supabase  = require('../lib/supabase');

const router = express.Router();

// Generate shareable booking link (tutors only)
router.post('/generate-link', authenticateUser, async (req, res) => {
  try {
    const { classId, expiresAt } = req.body;
    const userId = req.user.id;

    // Check if user is a tutor
    if (req.user.userType !== 'TUTOR') {
      return res.status(403).json({ message: 'Only tutors can generate booking links' });
    }

    // Check if class exists and belongs to the tutor
    const { data: classData, error: classError } = await supabase
      .from('classes')
      .select('*')
      .eq('id', classId)
      .single();

    if (classError || !classData) {
      return res.status(404).json({ message: 'Class not found' });
    }

    if (classData.tutor_id !== userId) {
      return res.status(403).json({ message: 'You can only generate links for your own classes' });
    }

    // Generate unique token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAtDate = expiresAt ? new Date(expiresAt).toISOString() : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    // Create booking link
    const { data: bookingLink, error: linkError } = await supabase
      .from('booking_links')
      .insert({
        token,
        class_id: classId,
        tutor_id: userId,
        expires_at: expiresAtDate,
        is_active: true
      })
      .select(`
        *,
        class:classes (
          id,
          title,
          subject,
          duration_minutes,
          price_per_session
        )
      `)
      .single();

    if (linkError) {
      console.error('Error creating booking link:', linkError);
      return res.status(500).json({ message: 'Failed to create booking link' });
    }

    const shareableUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/book/${token}`;

    res.status(201).json({ 
      data: {
        ...bookingLink,
        shareableUrl
      }
    });
  } catch (error) {
    console.error('Error generating booking link:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get booking link info (public)
router.get('/link/:token', async (req, res) => {
  try {
    const { token } = req.params;

    const { data: bookingLink, error } = await supabase
      .from('booking_links')
      .select(`
        *,
        class:classes (
          *,
          tutor:users!classes_tutor_id_fkey (
            id,
            first_name,
            last_name,
            email,
            bio,
            subjects,
            hourly_rate
          )
        )
      `)
      .eq('token', token)
      .single();

    if (error || !bookingLink) {
      return res.status(404).json({ message: 'Booking link not found' });
    }

    if (!bookingLink.is_active) {
      return res.status(400).json({ message: 'This booking link is no longer active' });
    }

    if (new Date(bookingLink.expires_at) < new Date()) {
      return res.status(400).json({ message: 'This booking link has expired' });
    }

    res.json({ data: bookingLink });
  } catch (error) {
    console.error('Error fetching booking link:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Create booking via shareable link (public)
router.post('/link/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const { scheduledAt, notes, studentName, studentEmail } = req.body;

    // Validate booking link
    const { data: bookingLink, error: linkError } = await supabase
      .from('booking_links')
      .select(`
        *,
        class:classes (*)
      `)
      .eq('token', token)
      .single();

    if (linkError || !bookingLink) {
      return res.status(404).json({ message: 'Booking link not found' });
    }

    if (!bookingLink.is_active) {
      return res.status(400).json({ message: 'This booking link is no longer active' });
    }

    if (new Date(bookingLink.expires_at) < new Date()) {
      return res.status(400).json({ message: 'This booking link has expired' });
    }

    // Check if class is still active
    if (!bookingLink.class.is_active) {
      return res.status(400).json({ message: 'This class is no longer available for booking' });
    }

    // Check if the scheduled time is in the future
    const scheduledDate = new Date(scheduledAt);
    if (scheduledDate <= new Date()) {
      return res.status(400).json({ message: 'Booking must be scheduled for a future time' });
    }

    // Find or create student user
    let { data: student } = await supabase
      .from('users')
      .select('*')
      .eq('email', studentEmail)
      .single();

    if (!student) {
      // Create new student account with default password
      const defaultPassword = crypto.randomBytes(16).toString('hex');
      const passwordHash = await bcrypt.hash(defaultPassword, 10);
      
      const nameParts = studentName.split(' ');
      const { data: newStudent, error: userError } = await supabase
        .from('users')
        .insert({
          email: studentEmail,
          first_name: nameParts[0] || studentName,
          last_name: nameParts.slice(1).join(' ') || '',
          user_type: 'STUDENT',
          is_verified: true,
          is_active: true,
          password_hash: passwordHash,
          subjects: ''
        })
        .select()
        .single();

      if (userError) {
        console.error('Error creating student:', userError);
        return res.status(500).json({ message: 'Failed to create student account' });
      }

      student = newStudent;
    }

    // Check for booking conflicts
    const conflictStart = new Date(scheduledDate.getTime() - 30 * 60 * 1000).toISOString();
    const conflictEnd = new Date(scheduledDate.getTime() + 30 * 60 * 1000).toISOString();

    const { data: existingBooking } = await supabase
      .from('bookings')
      .select('id')
      .eq('student_id', student.id)
      .gte('scheduled_at', conflictStart)
      .lte('scheduled_at', conflictEnd)
      .limit(1)
      .single();

    // Check for tutor conflicts
    const { data: tutorConflict } = await supabase
      .from('bookings')
      .select('id')
      .eq('tutor_id', bookingLink.class.tutor_id)
      .in('status', ['PENDING', 'CONFIRMED'])
      .gte('scheduled_at', conflictStart)
      .lte('scheduled_at', conflictEnd)
      .limit(1)
      .single();

    if (existingBooking) {
      return res.status(409).json({ message: 'You already have a booking at this time' });
    }

    if (tutorConflict) {
      return res.status(409).json({ message: 'The tutor is not available at this time' });
    }

    // Create the booking
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .insert({
        class_id: bookingLink.class_id,
        student_id: student.id,
        tutor_id: bookingLink.class.tutor_id,
        scheduled_at: scheduledDate.toISOString(),
        notes: notes || '',
        status: 'PENDING',
        total_amount: bookingLink.class.price_per_session
      })
      .select(`
        *,
        class:classes (
          *,
          tutor:users!classes_tutor_id_fkey (
            id,
            first_name,
            last_name,
            email
          )
        ),
        student:users!bookings_student_id_fkey (
          id,
          first_name,
          last_name,
          email
        )
      `)
      .single();

    if (bookingError) {
      console.error('Error creating booking:', bookingError);
      return res.status(500).json({ message: 'Failed to create booking' });
    }

    res.status(201).json({ data: booking });
  } catch (error) {
    console.error('Error creating booking via link:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Tutor schedules class for student
router.post('/schedule', authenticateUser, async (req, res) => {
  try {
    const { classId, studentEmail, scheduledAt, notes } = req.body;
    const userId = req.user.id;

    // Check if user is a tutor
    if (req.user.userType !== 'TUTOR') {
      return res.status(403).json({ message: 'Only tutors can schedule classes' });
    }

    // Check if class exists and belongs to the tutor
    const { data: classData, error: classError } = await supabase
      .from('classes')
      .select('*')
      .eq('id', classId)
      .single();

    if (classError || !classData) {
      return res.status(404).json({ message: 'Class not found' });
    }

    if (classData.tutor_id !== userId) {
      return res.status(403).json({ message: 'You can only schedule classes for your own classes' });
    }

    if (!classData.is_active) {
      return res.status(400).json({ message: 'This class is not active' });
    }

    // Find student by email
    const { data: student, error: studentError } = await supabase
      .from('users')
      .select('*')
      .eq('email', studentEmail)
      .single();

    if (studentError || !student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    if (student.user_type !== 'STUDENT') {
      return res.status(400).json({ message: 'The provided email does not belong to a student' });
    }

    // Check if the scheduled time is in the future
    const scheduledDate = new Date(scheduledAt);
    if (scheduledDate <= new Date()) {
      return res.status(400).json({ message: 'Booking must be scheduled for a future time' });
    }

    // Check for booking conflicts
    const conflictStart = new Date(scheduledDate.getTime() - 30 * 60 * 1000).toISOString();
    const conflictEnd = new Date(scheduledDate.getTime() + 30 * 60 * 1000).toISOString();

    const { data: existingBooking } = await supabase
      .from('bookings')
      .select('id')
      .eq('student_id', student.id)
      .gte('scheduled_at', conflictStart)
      .lte('scheduled_at', conflictEnd)
      .limit(1)
      .single();

    const { data: tutorConflict } = await supabase
      .from('bookings')
      .select('id')
      .eq('tutor_id', classData.tutor_id)
      .in('status', ['PENDING', 'CONFIRMED'])
      .gte('scheduled_at', conflictStart)
      .lte('scheduled_at', conflictEnd)
      .limit(1)
      .single();

    if (existingBooking) {
      return res.status(400).json({ message: 'Student already has a booking at this time' });
    }

    if (tutorConflict) {
      return res.status(400).json({ message: 'You are not available at this time' });
    }

    // Create the booking
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .insert({
        class_id: classId,
        student_id: student.id,
        tutor_id: classData.tutor_id,
        scheduled_at: scheduledDate.toISOString(),
        notes: notes || '',
        status: 'CONFIRMED', // Auto-confirm when tutor schedules
        total_amount: classData.price_per_session
      })
      .select(`
        *,
        class:classes (
          *,
          tutor:users!classes_tutor_id_fkey (
            id,
            first_name,
            last_name,
            email
          )
        ),
        student:users!bookings_student_id_fkey (
          id,
          first_name,
          last_name,
          email
        )
      `)
      .single();

    if (bookingError) {
      console.error('Error creating booking:', bookingError);
      return res.status(500).json({ message: 'Failed to create booking' });
    }

    res.status(201).json({ data: booking });
  } catch (error) {
    console.error('Error scheduling class:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get all bookings for the authenticated user
router.get('/', authenticateUser, async (req, res) => {
  try {
    const userId = req.user.id;
    const userType = req.user.userType;
    const { classId } = req.query;

    let query = supabase
      .from('bookings')
      .select(`
        *,
        class:classes (
          id,
          title,
          subject,
          duration_minutes,
          price_per_session,
          tutor:users!classes_tutor_id_fkey (
            id,
            first_name,
            last_name,
            email
          )
        ),
        student:users!bookings_student_id_fkey (
          id,
          first_name,
          last_name,
          email
        )
      `)
      .order('scheduled_at', { ascending: false });

    if (userType === 'TUTOR') {
      query = query.eq('tutor_id', userId);
    } else {
      query = query.eq('student_id', userId);
    }

    if (classId) {
      query = query.eq('class_id', classId);
    }

    const { data: bookings, error } = await query;

    if (error) {
      console.error('Error fetching bookings:', error);
      return res.status(500).json({ message: 'Failed to fetch bookings' });
    }

    res.json({ 
      data: bookings.map(b => ({
        ...b,
        tutorId: b.class?.tutor?.id
      }))
    });
  } catch (error) {
    console.error('Error fetching bookings:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get all bookings for a tutor (public, for calendar)
router.get('/tutor/:tutorId', async (req, res) => {
  try {
    const { tutorId } = req.params;
    const { status, from, to, classId } = req.query;
    
    let query = supabase
      .from('bookings')
      .select(`
        id,
        scheduled_at,
        status,
        class_id,
        student_id,
        class:classes (
          title,
          duration_minutes
        ),
        student:users!bookings_student_id_fkey (
          first_name,
          last_name
        )
      `)
      .eq('tutor_id', tutorId)
      .order('scheduled_at', { ascending: true });
    
    // Handle status filter
    if (status) {
      if (Array.isArray(status)) {
        query = query.in('status', status);
      } else {
        query = query.eq('status', status);
      }
    }
    
    if (from) {
      query = query.gte('scheduled_at', new Date(from).toISOString());
    }
    
    if (to) {
      query = query.lte('scheduled_at', new Date(to).toISOString());
    }
    
    if (classId) {
      query = query.eq('class_id', classId);
    }
    
    const { data: bookings, error } = await query;
    
    if (error) {
      console.error('Error fetching tutor bookings:', error);
      return res.status(500).json({ message: 'Failed to fetch bookings' });
    }
    
    // Transform the data
    const transformedBookings = bookings.map(booking => ({
      id: booking.id,
      scheduledAt: booking.scheduled_at,
      status: booking.status,
      classId: booking.class_id,
      studentId: booking.student_id,
      studentName: `${booking.student.first_name} ${booking.student.last_name}`,
      durationMinutes: booking.class.duration_minutes,
      classTitle: booking.class.title
    }));
    
    res.json({ data: transformedBookings });
  } catch (error) {
    console.error('Error fetching tutor bookings:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});



// Create new booking (students only)
router.post('/', authenticateUser, async (req, res) => {
  try {
    const { classId, scheduledAt, notes } = req.body;
    const userId = req.user.id;

    if (!classId || !scheduledAt) {
      return res.status(400).json({ message: 'classId and scheduledAt are required' });
    }

    // Check if user is a student
    if (req.user.userType !== 'STUDENT') {
      return res.status(403).json({ message: 'Only students can create bookings' });
    }

    // Check if class exists and is active
    const { data: classData, error: classError } = await supabase
      .from('classes')
      .select('*')
      .eq('id', classId)
      .single();

    if (classError || !classData) {
      return res.status(404).json({ message: 'Class not found' });
    }

    if (!classData.is_active) {
      return res.status(400).json({ message: 'This class is not available for booking' });
    }

    // Check if the scheduled time is in the future
    const scheduledDate = new Date(scheduledAt);
    if (scheduledDate <= new Date()) {
      return res.status(400).json({ message: 'Booking must be scheduled for a future time' });
    }

    // Check for booking conflicts
    const conflictStart = new Date(scheduledDate.getTime() - 30 * 60 * 1000).toISOString();
    const conflictEnd = new Date(scheduledDate.getTime() + 30 * 60 * 1000).toISOString();

    const { data: existingBooking } = await supabase
      .from('bookings')
      .select('id')
      .eq('student_id', userId)
      .gte('scheduled_at', conflictStart)
      .lte('scheduled_at', conflictEnd)
      .limit(1)
      .single();

    const { data: tutorConflict } = await supabase
      .from('bookings')
      .select('id')
      .eq('tutor_id', classData.tutor_id)
      .in('status', ['PENDING', 'CONFIRMED'])
      .gte('scheduled_at', conflictStart)
      .lte('scheduled_at', conflictEnd)
      .limit(1)
      .single();

    if (existingBooking) {
      return res.status(409).json({ message: 'You already have a booking at this time' });
    }

    if (tutorConflict) {
      return res.status(409).json({ message: 'The tutor is not available at this time' });
    }

    // Create the booking
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .insert({
        class_id: classId,
        student_id: userId,
        tutor_id: classData.tutor_id,
        scheduled_at: scheduledDate.toISOString(),
        notes: notes || '',
        status: 'PENDING',
        total_amount: classData.price_per_session
      })
      .select(`
        *,
        class:classes (
          *,
          tutor:users!classes_tutor_id_fkey (
            id,
            first_name,
            last_name,
            email
          )
        ),
        student:users!bookings_student_id_fkey (
          id,
          first_name,
          last_name,
          email
        )
      `)
      .single();

    if (bookingError) {
      console.error('Error creating booking:', bookingError);
      return res.status(500).json({ message: 'Failed to create booking' });
    }

    res.status(201).json({ data: booking });
  } catch (error) {
    console.error('Error creating booking:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PATCH /api/bookings/:id/status
router.patch('/:id/status', authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const userId = req.user.id;
    const userType = req.user.userType;

    if (!status) {
      return res.status(400).json({ message: 'Status is required' });
    }

    // Find the booking
    const { data: booking, error: findError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', id)
      .single();

    if (findError || !booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // Only the tutor or the student who owns the booking can update status
    if (userType === 'TUTOR') {
      if (status !== 'CONFIRMED' && status !== 'CANCELLED') {
        return res.status(400).json({ message: 'Tutors can only set status to CONFIRMED or CANCELLED' });
      }
      if (booking.tutor_id !== userId) {
        return res.status(403).json({ message: 'You do not have permission to update this booking' });
      }
    } else if (userType === 'STUDENT') {
      if (status !== 'CANCELLED') {
        return res.status(400).json({ message: 'Students can only set status to CANCELLED' });
      }
      if (booking.student_id !== userId) {
        return res.status(403).json({ message: 'You do not have permission to cancel this booking' });
      }
    } else {
      return res.status(403).json({ message: 'Invalid user type' });
    }

    // Update the booking status
    const { data: updated, error: updateError } = await supabase
      .from('bookings')
      .update({ status })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating booking:', updateError);
      return res.status(500).json({ message: 'Failed to update booking' });
    }

    return res.status(200).json({ success: true, data: updated });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// DELETE /api/bookings/:id
router.delete('/:id', authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const { data: booking, error: findError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', id)
      .single();

    if (findError || !booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // Only students can delete their own bookings
    if (req.user.userType !== 'STUDENT' || booking.student_id !== userId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { error: deleteError } = await supabase
      .from('bookings')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Error deleting booking:', deleteError);
      return res.status(500).json({ message: 'Failed to delete booking' });
    }

    res.json({ message: 'Booking cancelled successfully' });
  } catch (error) {
    console.error('Error deleting booking:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Zod schema for reschedule request
const rescheduleSchema = z.object({
  proposedTime: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Invalid date format',
  })
});

// POST /api/bookings/:id/reschedule - Propose a reschedule
router.post('/:id/reschedule', authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;
    const { proposedTime } = req.body;
    const userId = req.user.id;

    // Validate input
    const parse = rescheduleSchema.safeParse({ proposedTime });
    if (!parse.success) {
      return res.status(400).json({ errors: parse.error.errors });
    }

    // Check booking exists and user is participant
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select(`
        *,
        student:users!bookings_student_id_fkey (*),
        class:classes (
          *,
          tutor:users!classes_tutor_id_fkey (*)
        )
      `)
      .eq('id', id)
      .single();

    if (bookingError || !booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    if (booking.student_id !== userId && booking.class.tutor_id !== userId) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Create reschedule request
    const { data: request, error: requestError } = await supabase
      .from('reschedule_requests')
      .insert({
        booking_id: id,
        requested_by_id: userId,
        proposed_time: new Date(proposedTime).toISOString(),
        status: 'PENDING'
      })
      .select()
      .single();

    if (requestError) {
      console.error('Error creating reschedule request:', requestError);
      return res.status(500).json({ message: 'Failed to create reschedule request' });
    }

    return res.status(201).json({ data: request });
  } catch (error) {
    console.error('Reschedule propose error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/bookings/:id/reschedule/:requestId/accept - Accept reschedule
router.post('/:id/reschedule/:requestId/accept', authenticateUser, async (req, res) => {
  try {
    const { id, requestId } = req.params;
    const userId = req.user.id;

    // Find reschedule request
    const { data: request, error: requestError } = await supabase
      .from('reschedule_requests')
      .select(`
        *,
        booking:bookings (
          *,
          class:classes (*)
        )
      `)
      .eq('id', requestId)
      .single();

    if (requestError || !request || request.booking_id !== id) {
      return res.status(404).json({ message: 'Request not found' });
    }

    if (request.status !== 'PENDING') {
      return res.status(400).json({ message: 'Request already handled' });
    }


    // Only the other party can decline
    if (request.requested_by_id === booking.student_id && userId !== booking.class.tutor_id) {
      return res.status(403).json({ message: 'Only tutor can decline' });
    }
    if (request.requested_by_id === booking.class.tutor_id && userId !== booking.student_id) {
      return res.status(403).json({ message: 'Only student can decline' });
    }

    const { error: updateError } = await supabase
      .from('reschedule_requests')
      .update({ status: 'DECLINED' })
      .eq('id', requestId);

    if (updateError) {
      console.error('Error declining reschedule:', updateError);
      return res.status(500).json({ message: 'Failed to decline reschedule' });
    }

    return res.status(200).json({ message: 'Reschedule declined' });
  } catch (error) {
    console.error('Reschedule decline error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/bookings/:id/reschedule/:requestId/decline - Decline reschedule
router.post('/:id/reschedule/:requestId/decline', authenticateUser, async (req, res) => {
  try {
    const { id, requestId } = req.params;
    const userId = req.user.id;

    // Find reschedule request with booking + class
    const { data: request, error: requestError } = await supabase
      .from('reschedule_requests')
      .select(`
        *,
        booking:bookings (
          *,
          class:classes (*)
        )
      `)
      .eq('id', requestId)
      .single();

    if (requestError || !request || request.booking_id !== id) {
      return res.status(404).json({ message: 'Request not found' });
    }
    if (request.status !== 'PENDING') {
      return res.status(400).json({ message: 'Request already handled' });
    }

    const booking = request.booking;

    // Only the other party can decline
    if (request.requested_by_id === booking.student_id && userId !== booking.class.tutor_id) {
      return res.status(403).json({ message: 'Only tutor can decline' });
    }
    if (request.requested_by_id === booking.class.tutor_id && userId !== booking.student_id) {
      return res.status(403).json({ message: 'Only student can decline' });
    }

    const { error: updateError } = await supabase
      .from('reschedule_requests')
      .update({ status: 'DECLINED' })
      .eq('id', requestId);

    if (updateError) {
      console.error('Error declining reschedule:', updateError);
      return res.status(500).json({ message: 'Failed to decline reschedule' });
    }

    return res.status(200).json({ message: 'Reschedule declined' });
  } catch (error) {
    console.error('Reschedule decline error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/reschedule-requests - Get all reschedule requests for the current user
router.get('/reschedule-requests', authenticateUser, async (req, res) => {
  try {
    const userId = req.user.id;

    // First, get all bookings where user is involved
    const { data: userBookings, error: bookingError } = await supabase
      .from('bookings')
      .select('id')
      .or(`student_id.eq.${userId},tutor_id.eq.${userId}`);

    if (bookingError) {
      console.error('Error fetching user bookings:', bookingError);
      return res.status(500).json({ message: 'Failed to fetch bookings' });
    }

    const bookingIds = userBookings.map(b => b.id);

    // Now get reschedule requests for those bookings OR requested by user
    const { data: requests, error } = await supabase
      .from('reschedule_requests')
      .select(`
        *,
        booking:bookings (
          *,
          student:users!bookings_student_id_fkey (
            id, first_name, last_name, email
          ),
          class:classes (
            id, title, subject, tutor_id,
            tutor:users!classes_tutor_id_fkey (
              id, first_name, last_name, email
            )
          )
        ),
        requested_by:users (
          id, first_name, last_name, email
        )
      `)
      .or(`requested_by_id.eq.${userId},booking_id.in.(${bookingIds.join(',')})`);

    if (error) {
      console.error('Error fetching reschedule requests:', error);
      return res.status(500).json({ message: 'Failed to fetch requests' });
    }

    res.json({ data: requests });
  } catch (error) {
    console.error('Reschedule request fetch error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get booking by ID
router.get('/:id', authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userType = req.user.userType;

    const { data: booking, error } = await supabase
      .from('bookings')
      .select(`
        *,
        class:classes (
          *,
          tutor:users!classes_tutor_id_fkey (
            id,
            first_name,
            last_name,
            email,
            bio
          )
        ),
        student:users!bookings_student_id_fkey (
          id,
          first_name,
          last_name,
          email
        )
      `)
      .eq('id', id)
      .single();

    if (error || !booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // Check if user has access to this booking
    if (userType === 'STUDENT' && booking.student_id !== userId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    if (userType === 'TUTOR' && booking.tutor_id !== userId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json({ data: booking });
  } catch (error) {
    console.error('Error fetching booking:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/bookings/:id/reschedule - Get all reschedule requests for a specific booking
// GET /api/bookings/:id/reschedule - Get all reschedule requests for a specific booking
router.get('/:id/reschedule', authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Fetch booking with class info
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select(`
        *,
        class:classes (*)
      `)
      .eq('id', id)
      .single();

    if (bookingError || !booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // Authorization check: must be student or tutor
    if (booking.student_id !== userId && booking.class.tutor_id !== userId) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Fetch all reschedule requests for this booking
    const { data: requests, error: requestsError } = await supabase
      .from('reschedule_requests')
      .select(`
        *,
        requested_by:users (
          id, first_name, last_name, email
        )
      `)
      .eq('booking_id', id)
      .order('created_at', { ascending: false });

    if (requestsError) {
      console.error('Error fetching reschedule requests:', requestsError);
      return res.status(500).json({ message: 'Failed to fetch reschedule requests' });
    }

    res.json({ data: requests });
  } catch (error) {
    console.error('Error fetching reschedule requests for booking:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router; 