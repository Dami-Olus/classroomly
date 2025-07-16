import React, { useEffect, useState } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';

export type Slot = {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  timezone: string;
};

export type Booking = {
  id: string;
  scheduledAt: string;
  status: string;
  studentName?: string; // Added for student name in booking
  durationMinutes?: number;
  classTitle?: string;
};

interface TutorBookingCalendarProps {
  tutorId: string;
  classId: string;
  onDateSelect?: (date: Date, availability: Slot[], bookings: Booking[]) => void;
  onSlotSelect?: (timeSlot: { start: Date; slot: any }) => void;
  userType?: string;
  durationMinutes?: number;
  calendarRefreshKey?: number;
}

const daysOfWeek = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
];

function getTimeParts(time: string) {
  const [h, m] = time.split(':').map(Number);
  return { h, m };
}

export function getAvailableStartTimes(
  date: Date,
  availability: Slot[],
  bookings: Booking[],
  durationMinutes: number,
  bufferMinutes: number = 0
): { start: Date; slot: Slot; booking?: Booking }[] {
  const dayOfWeek = date.getDay();
  console.log('Looking for availability on day:', dayOfWeek, '(', ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek], ')');
  console.log('All availability slots:', availability);
  
  const slots = availability.filter(slot => slot.dayOfWeek === dayOfWeek);
  console.log('Filtered slots for this day:', slots);
  
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
          if (hasConflict) {
            console.log('Global conflict found:', {
              slotStart: slotStartTime.toLocaleString(),
              slotEnd: slotEndTime.toLocaleString(),
              bookingStart: bookedStart.toLocaleString(),
              bookingEnd: bookedEnd.toLocaleString(),
              bookingStatus: booking.status,
              bookingId: booking.id,
              conflictingClass: booking.classTitle || 'Unknown Class',
              studentName: booking.studentName || 'Unknown Student'
            });
          }
          return hasConflict;
        }
        return false;
      });
      
      if (!booking) {
        console.log('Available slot:', slotStartTime.toLocaleTimeString(), '-', slotEndTime.toLocaleTimeString());
        availableTimes.push({ start: new Date(t), slot });
      } else {
        console.log('Unavailable slot:', slotStartTime.toLocaleTimeString(), '-', slotEndTime.toLocaleTimeString(), 'due to booking in class:', booking.classTitle || 'Unknown Class');
        availableTimes.push({ start: new Date(t), slot, booking });
      }
    }
  }
  return availableTimes;
}

const TutorBookingCalendar: React.FC<TutorBookingCalendarProps> = ({ 
  tutorId, 
  classId, 
  onDateSelect, 
  onSlotSelect,
  userType, 
  durationMinutes = 60,
  calendarRefreshKey = 0
}) => {
  const [availability, setAvailability] = useState<Slot[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [bookingError, setBookingError] = useState('');
  const [slotsForDay, setSlotsForDay] = useState<{ start: Date; slot: Slot; booking?: Booking }[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ start: Date; slot: Slot } | null>(null);
  const [studentEmail, setStudentEmail] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState('');
  const [inviteError, setInviteError] = useState('');
  const [shareLink, setShareLink] = useState('');
  const [shareLoading, setShareLoading] = useState(false);
  const [shareError, setShareError] = useState('');

  // Fetch availability and bookings
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        // Fetch availability with conflicts for better accuracy
        const availRes = await fetch(`http://localhost:4000/api/availability/${tutorId}/with-conflicts`);
        const availData = await availRes.json();
        setAvailability(availData.data || []);
        
        // Always fetch ALL tutor bookings to check availability across all classes
        // This ensures that if a time slot is booked for any class, it shows as unavailable
        const url = `http://localhost:4000/api/bookings/tutor/${tutorId}?status=PENDING&status=CONFIRMED`;
        
        const bookRes = await fetch(url);
        const bookData = await bookRes.json();
        setBookings(bookData.data || []);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    }
    if (tutorId) fetchData();
  }, [tutorId, classId, userType, calendarRefreshKey]);

  // Set up polling for real-time updates every 30 seconds
  useEffect(() => {
    if (!tutorId) return;
    
    const interval = setInterval(async () => {
      try {
        // Fetch availability with conflicts
        const availRes = await fetch(`http://localhost:4000/api/availability/${tutorId}/with-conflicts`);
        const availData = await availRes.json();
        setAvailability(availData.data || []);
        
        // Always fetch ALL tutor bookings for global availability checking
        const url = `http://localhost:4000/api/bookings/tutor/${tutorId}?status=PENDING&status=CONFIRMED`;
        
        const bookRes = await fetch(url);
        const bookData = await bookRes.json();
        setBookings(bookData.data || []);
      } catch (error) {
        console.error('Error polling for updates:', error);
      }
    }, 30000); // Poll every 30 seconds

    return () => clearInterval(interval);
  }, [tutorId, classId, userType]);

  // Listen for availability change events
  useEffect(() => {
    const handleAvailabilityChange = async () => {
      if (!tutorId) return;
      
      try {
        console.log('Availability changed, refreshing calendar...');
        console.log('Current availability before refresh:', availability);
        
        // Fetch availability with conflicts
        const availRes = await fetch(`http://localhost:4000/api/availability/${tutorId}/with-conflicts`);
        const availData = await availRes.json();
        console.log('New availability data from API:', availData.data);
        setAvailability(availData.data || []);
        
        // Always fetch ALL tutor bookings for global availability checking
        const url = `http://localhost:4000/api/bookings/tutor/${tutorId}?status=PENDING&status=CONFIRMED`;
        
        const bookRes = await fetch(url);
        const bookData = await bookRes.json();
        setBookings(bookData.data || []);
        
        console.log('Calendar refreshed after availability change');
      } catch (error) {
        console.error('Error refreshing calendar after availability change:', error);
      }
    };

    window.addEventListener('availabilityChanged', handleAvailabilityChange);
    return () => window.removeEventListener('availabilityChanged', handleAvailabilityChange);
  }, [tutorId, classId, userType]);

  // Fetch bookings for specific date when date is selected
  useEffect(() => {
    async function fetchBookingsForDate() {
      if (!selectedDate || !tutorId) return;
      
      try {
        const startOfDay = new Date(selectedDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(selectedDate);
        endOfDay.setHours(23, 59, 59, 999);
        
        console.log('Fetching bookings for date:', selectedDate.toLocaleDateString());
        console.log('User type:', userType);
        console.log('Date range:', startOfDay.toISOString(), 'to', endOfDay.toISOString());
        
        // Always fetch ALL tutor bookings for global availability checking
        const url = `http://localhost:4000/api/bookings/tutor/${tutorId}?status=PENDING&status=CONFIRMED&from=${startOfDay.toISOString()}&to=${endOfDay.toISOString()}`;
        
        console.log('Fetching URL:', url);
        const bookRes = await fetch(url);
        const bookData = await bookRes.json();
        console.log('Bookings returned:', bookData.data);
        setBookings(bookData.data || []);
      } catch (error) {
        console.error('Error fetching bookings for date:', error);
      }
    }
    
    fetchBookingsForDate();
  }, [selectedDate, tutorId, classId, userType, calendarRefreshKey]);

  // When date is selected, compute slots
  useEffect(() => {
    if (selectedDate) {
      console.log('Computing slots for date:', selectedDate.toLocaleDateString());
      console.log('User type:', userType);
      console.log('Checking availability across ALL tutor classes for global conflict detection');
      console.log('Current availability slots:', availability);
      console.log('Available bookings:', bookings);
      const slots = getAvailableStartTimes(selectedDate, availability, bookings, durationMinutes);
      console.log('Generated slots:', slots);
      setSlotsForDay(slots);
    } else {
      setSlotsForDay([]);
    }
  }, [selectedDate, availability, bookings, durationMinutes, userType]);

  // Book a slot (for students)
  const handleBook = async (slot: { start: Date; slot: Slot }) => {
    setBookingLoading(true);
    setBookingError('');
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch('http://localhost:4000/api/bookings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          classId: classId,
          scheduledAt: slot.start.toISOString(),
          notes: ''
        })
      });
      if (!response.ok) {
        const err = await response.json();
        setBookingError(err.message || 'Failed to book session.');
        setBookingLoading(false);
        return;
      }
      setBookingSuccess(true);
      setTimeout(() => setBookingSuccess(false), 3000);
      
      // Dispatch custom event to notify dashboard of booking creation
      window.dispatchEvent(new CustomEvent('bookingCreated', {
        detail: { classId, tutorId }
      }));
    } catch (e) {
      setBookingError('Failed to book session.');
    } finally {
      setBookingLoading(false);
    }
  };

  // Tutor: open modal on slot click
  const handleTutorSlotClick = (slot: { start: Date; slot: Slot }) => {
    setSelectedSlot(slot);
    setModalOpen(true);
    setStudentEmail('');
    setInviteSuccess('');
    setInviteError('');
    setShareLink('');
    setShareError('');
  };

  // Tutor: send invite
  const handleSendInvite = async () => {
    if (!studentEmail || !selectedSlot) return;
    setInviteLoading(true);
    setInviteSuccess('');
    setInviteError('');
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch('http://localhost:4000/api/bookings/schedule', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          classId: classId,
          scheduledAt: selectedSlot.start.toISOString(),
          studentEmail,
          notes: ''
        })
      });
      if (!response.ok) {
        const err = await response.json();
        setInviteError(err.message || 'Failed to send invite.');
        setInviteLoading(false);
        return;
      }
      setInviteSuccess('Invite sent successfully!');
      
      // Dispatch custom event to notify dashboard of booking creation
      window.dispatchEvent(new CustomEvent('bookingCreated', {
        detail: { classId, tutorId }
      }));
    } catch (e) {
      setInviteError('Failed to send invite.');
    } finally {
      setInviteLoading(false);
    }
  };

  // Tutor: generate shareable link
  const handleGenerateShareLink = async () => {
    if (!selectedSlot) return;
    setShareLoading(true);
    setShareError('');
    setShareLink('');
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch('http://localhost:4000/api/bookings/generate-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          classId: classId,
          scheduledAt: selectedSlot.start.toISOString(),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        })
      });
      const result = await response.json();
      if (!response.ok) {
        setShareError(result.message || 'Failed to generate link.');
        setShareLoading(false);
        return;
      }
      setShareLink(result.data.shareableUrl);
    } catch (e) {
      setShareError('Failed to generate link.');
    } finally {
      setShareLoading(false);
    }
  };

  // Calendar tile content: highlight days with available slots
  function tileClassName({ date }: { date: Date }) {
    const slots = availability.filter(slot => slot.dayOfWeek === date.getDay());
    return slots.length > 0 ? 'react-calendar__tile--has-availability' : '';
  }

  return (
    <div className="flex flex-col md:flex-row bg-white rounded-lg shadow p-4 md:p-6 gap-4 md:gap-8 w-full max-w-3xl mx-auto">
      {/* Left: Calendar */}
      <div className="w-full md:w-1/2 flex flex-col items-center md:items-start">
        <h3 className="text-lg font-semibold mb-2 w-full text-center md:text-left">Select a Date & Time</h3>
        <div className="w-full flex justify-center md:justify-start">
          <div className="w-full max-w-xs">
            <Calendar
              onChange={(value) => {
                if (value instanceof Date) {
                  setSelectedDate(value);
                  if (onDateSelect) onDateSelect(value, availability, bookings);
                }
              }}
              value={selectedDate}
              tileClassName={tileClassName}
              className="w-full"
            />
          </div>
        </div>
        <div className="mt-2 text-xs text-gray-500 w-full text-center md:text-left">
          <span className="inline-flex items-center"><span className="w-2 h-2 bg-green-500 rounded-full mr-1"></span>times you're available</span>
        </div>
        <div className="mt-2 text-xs text-gray-500 w-full text-center md:text-left">
          Timezone: {Intl.DateTimeFormat().resolvedOptions().timeZone}
        </div>
        <div className="mt-2 text-xs text-blue-600 w-full text-center md:text-left">
          <span className="inline-flex items-center">
            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Availability shown across all your classes
          </span>
        </div>
      </div>
      {/* Right: Slots for selected day */}
      <div className="w-full md:w-1/2 mt-6 md:mt-0">
        {selectedDate ? (
          <>
            <div className="mb-2 font-medium text-gray-700 text-center md:text-left">{selectedDate.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
            {loading ? (
              <div>Loading slots...</div>
            ) : slotsForDay.length === 0 ? (
              <div className="text-gray-400 text-center md:text-left">No available slots for this day.</div>
            ) : (
              <div className="flex flex-col gap-2 max-h-80 overflow-y-auto pr-1">
                {slotsForDay.map((slot, idx) => (
                  <button
                    key={idx}
                    className={`flex items-center justify-between px-4 py-2 rounded border text-left transition-all ${slot.booking ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'} ${bookingLoading ? 'opacity-50' : ''}`}
                    disabled={!!slot.booking || bookingLoading}
                    onClick={() => {
                      if (userType === 'STUDENT' && !slot.booking) {
                        if (onSlotSelect) {
                          onSlotSelect(slot);
                        } else {
                          handleBook(slot);
                        }
                      } else if (userType === 'TUTOR' && !slot.booking) {
                        handleTutorSlotClick(slot);
                      }
                    }}
                  >
                    <span className="flex items-center">
                      <span className="w-2 h-2 rounded-full mr-2" style={{ background: slot.booking ? '#aaa' : '#22c55e' }}></span>
                      {slot.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {(() => {
                        const end = new Date(slot.start.getTime() + durationMinutes * 60000);
                        return end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                      })()}
                    </span>
                    {slot.booking ? (
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        slot.booking.status === 'PENDING' 
                          ? 'booking-status-pending' 
                          : slot.booking.status === 'CONFIRMED'
                          ? 'booking-status-confirmed'
                          : 'booking-status-cancelled'
                      }`}>
                        {slot.booking.status === 'PENDING' ? 'Pending' : 'Booked'}
                        {slot.booking.classTitle ? ` in ${slot.booking.classTitle}` : ''}
                        {userType === 'TUTOR' && slot.booking.studentName ? ` by ${slot.booking.studentName}` : ''}
                      </span>
                    ) : userType === 'STUDENT' ? (
                      <span className="text-xs font-semibold">Book</span>
                    ) : (
                      <span className="text-xs text-green-600">Available</span>
                    )}
                  </button>
                ))}
              </div>
            )}
            {bookingError && <div className="text-red-600 text-xs mt-2 text-center md:text-left">{bookingError}</div>}
            {bookingSuccess && <div className="text-green-600 text-xs mt-2 text-center md:text-left">Booking successful!</div>}
            {/* Tutor scheduling modal */}
            {userType === 'TUTOR' && modalOpen && selectedSlot && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
                <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-xs">
                  <h4 className="text-md font-semibold mb-2">Schedule this slot</h4>
                  <div className="mb-2 text-xs text-gray-700">{selectedSlot.start.toLocaleString()}</div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Student Email (optional)</label>
                  <input type="email" value={studentEmail} onChange={e => setStudentEmail(e.target.value)} className="w-full border rounded px-2 py-1 mb-2" placeholder="student@email.com" />
                  <button onClick={handleSendInvite} className="w-full bg-blue-600 text-white px-4 py-1 rounded mb-2" disabled={inviteLoading || !studentEmail}>{inviteLoading ? 'Sending...' : 'Send Invite'}</button>
                  {inviteSuccess && <div className="text-green-600 text-xs mb-2">{inviteSuccess}</div>}
                  {inviteError && <div className="text-red-600 text-xs mb-2">{inviteError}</div>}
                  <hr className="my-2" />
                  <button onClick={handleGenerateShareLink} className="w-full bg-purple-600 text-white px-4 py-1 rounded mb-2" disabled={shareLoading}>{shareLoading ? 'Generating...' : 'Generate Share Link'}</button>
                  {shareLink && (
                    <div className="flex items-center space-x-2 bg-gray-100 px-2 py-1 rounded mb-2">
                      <span className="text-xs text-gray-700 truncate">{shareLink}</span>
                      <button onClick={() => {navigator.clipboard.writeText(shareLink)}} className="text-blue-600 text-xs hover:underline">Copy</button>
                    </div>
                  )}
                  {shareError && <div className="text-red-600 text-xs mb-2">{shareError}</div>}
                  <button onClick={() => setModalOpen(false)} className="w-full bg-gray-300 px-4 py-1 rounded mt-2">Close</button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-gray-400 text-center md:text-left">Select a date to see available slots.</div>
        )}
      </div>
    </div>
  );
};

export default TutorBookingCalendar; 