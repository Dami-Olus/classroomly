import { Booking, Slot } from './TutorBookingCalendar';

export function getAvailableStartTimes(
  date: Date,
  availability: Slot[],
  bookings: Booking[],
  durationMinutes: number,
  bufferMinutes: number = 0
): { start: Date; slot: Slot; booking?: Booking }[] {
  const dayOfWeek = date.getDay();
  const slots = availability.filter(slot => slot.dayOfWeek === dayOfWeek);
  const availableTimes: { start: Date; slot: Slot; booking?: Booking }[] = [];

  for (const slot of slots) {
    const [sh, sm] = slot.startTime.split(':').map(Number);
    const [eh, em] = slot.endTime.split(':').map(Number);
    const slotStart = new Date(date);
    slotStart.setHours(sh, sm, 0, 0);
    const slotEnd = new Date(date);
    slotEnd.setHours(eh, em, 0, 0);

    for (
      let t = new Date(slotStart);
      t.getTime() + durationMinutes * 60000 <= slotEnd.getTime();
      t = new Date(t.getTime() + 60 * 60000)
    ) {
      const slotStartTime = new Date(t);
      const slotEndTime = new Date(t.getTime() + durationMinutes * 60000);

      // Check for conflicts with both PENDING and CONFIRMED bookings
      const booking = bookings.find(booking => {
        const bookedStart = new Date(booking.scheduledAt);
        const bookedDuration = booking.durationMinutes || durationMinutes;
        const bookedEnd = new Date(bookedStart.getTime() + bookedDuration * 60000);

        // Normalize dates to the same day for comparison
        const slotDate = new Date(slotStartTime);
        slotDate.setHours(0, 0, 0, 0);
        const bookedDate = new Date(bookedStart);
        bookedDate.setHours(0, 0, 0, 0);

        // Only check for conflicts if the booking is on the same day
        if (slotDate.getTime() === bookedDate.getTime()) {
          // Check if there's any overlap between the requested slot and existing booking
          const hasConflict = slotStartTime < bookedEnd && slotEndTime > bookedStart;
          return hasConflict;
        }
        return false;
      });

      if (!booking) {
        availableTimes.push({ start: new Date(t), slot });
      }
    }
  }
  return availableTimes;
} 