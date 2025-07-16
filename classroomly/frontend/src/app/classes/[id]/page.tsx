"use client";
import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import TutorBookingCalendar from '@/components/tutor/TutorBookingCalendar';
import BookingModal from '@/components/tutor/BookingModal';
import { getAvailableStartTimes } from '@/components/tutor/TutorBookingCalendar';

interface Class {
  id: string;
  title: string;
  description?: string;
  subject: string;
  level?: string;
  maxStudents: number;
  durationMinutes: number;
  pricePerSession: number;
  isActive: boolean;
  createdAt: string;
  tutor: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    bio?: string;
    subjects?: string;
    hourlyRate?: number;
  };
}

interface User {
  id: string;
  userType: 'TUTOR' | 'STUDENT';
}

export default function ClassDetailsPage() {
  const params = useParams();
  const classId = params.id as string;
  
  const [classData, setClassData] = useState<Class | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [availableTimes, setAvailableTimes] = useState<{ start: Date; slot: any }[]>([]);
  const [selectedStartTime, setSelectedStartTime] = useState<{ start: Date; slot: any } | null>(null);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [calendarRefreshKey, setCalendarRefreshKey] = useState(0);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingError, setBookingError] = useState('');
  const [generatingLink, setGeneratingLink] = useState(false);
  const [shareableLink, setShareableLink] = useState<string | null>(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [bookings, setBookings] = useState<any[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [bookingsError, setBookingsError] = useState('');
  const [currentStep, setCurrentStep] = useState<'calendar' | 'details' | 'confirmation'>('calendar');
  
  // Tutor scheduling flow states
  const [tutorScheduleStep, setTutorScheduleStep] = useState<'calendar' | 'student' | 'confirmation'>('calendar');
  const [tutorSelectedDate, setTutorSelectedDate] = useState<Date | null>(null);
  const [tutorSelectedTime, setTutorSelectedTime] = useState<{ start: Date; slot: any } | null>(null);
  const [tutorAvailableTimes, setTutorAvailableTimes] = useState<{ start: Date; slot: any }[]>([]);
  const [studentEmail, setStudentEmail] = useState('');
  const [scheduleNotes, setScheduleNotes] = useState('');
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleError, setScheduleError] = useState('');
  const [scheduleSuccess, setScheduleSuccess] = useState(false);

  useEffect(() => {
    // Get user info from token
    const token = localStorage.getItem('authToken');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setUser({
          id: payload.id,
          userType: payload.userType
        });
      } catch (error) {
        console.error('Error parsing token:', error);
      }
    }

    fetchClassDetails();
  }, [classId]);

  // Fetch bookings for this class if tutor
  useEffect(() => {
    if (user?.userType === 'TUTOR' && user.id === classData?.tutor.id) {
      setBookingsLoading(true);
      const token = localStorage.getItem('authToken');
      fetch(`http://localhost:4000/api/bookings?classId=${classId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
        .then(res => res.json())
        .then(data => {
          setBookings(data.data || []);
          setBookingsLoading(false);
        })
        .catch(() => {
          setBookingsError('Failed to fetch bookings');
          setBookingsLoading(false);
        });
    }
  }, [user, classData, classId]);

  // Listen for availability change events
  useEffect(() => {
    const handleAvailabilityChange = () => {
      console.log('Availability changed, refreshing calendar...');
      setCalendarRefreshKey(prev => prev + 1);
    };

    window.addEventListener('availabilityChanged', handleAvailabilityChange);
    return () => window.removeEventListener('availabilityChanged', handleAvailabilityChange);
  }, []);

  const fetchClassDetails = async () => {
    try {
      const response = await fetch(`http://localhost:4000/api/classes/${classId}`);
      const result = await response.json();

      if (response.ok) {
        setClassData(result.data);
      } else {
        setError(result.message || 'Failed to fetch class details');
      }
    } catch (err) {
      setError('An error occurred while fetching class details');
    } finally {
      setLoading(false);
    }
  };

  const handleBooking = async (formData: any) => {
    setBookingLoading(true);
    setBookingError('');
    setBookingSuccess(false);

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
          scheduledAt: formData.scheduledAt,
          notes: formData.notes || ''
        })
      });

      const result = await response.json();

      if (response.ok) {
        setBookingSuccess(true);
        setCurrentStep('confirmation');
        setCalendarRefreshKey(prev => prev + 1);
        setTimeout(() => {
          setBookingSuccess(false);
          setCurrentStep('calendar');
          setSelectedDate(null);
          setAvailableTimes([]);
          setSelectedStartTime(null);
        }, 5000);
      } else {
        setBookingError(result.message || 'Failed to create booking');
      }
    } catch (err) {
      setBookingError('An error occurred while creating the booking');
    } finally {
      setBookingLoading(false);
    }
  };

  const generateShareableLink = async () => {
    setGeneratingLink(true);
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
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
        })
      });

      const result = await response.json();

      if (response.ok) {
        setShareableLink(result.data.shareableUrl);
      } else {
        alert(result.message || 'Failed to generate shareable link');
      }
    } catch (err) {
      alert('An error occurred while generating the link');
    } finally {
      setGeneratingLink(false);
    }
  };

  const copyToClipboard = async () => {
    if (!shareableLink) return;
    try {
      await navigator.clipboard.writeText(shareableLink);
      alert('Link copied to clipboard!');
    } catch (err) {
      alert('Failed to copy link to clipboard');
    }
  };

  // Handler for calendar slot selection
  const handleSlotSelect = (date: Date, slot: any) => {
    setSelectedDate(date);
    if (classData) {
      const times = getAvailableStartTimes(date, slot.availability, slot.bookings, classData.durationMinutes);
      setAvailableTimes(times);
      setSelectedStartTime(null);
    }
  };

  // Handler for calendar date selection
  const handleDateSelect = (date: Date, availability: any[], bookings: any[]) => {
    setSelectedDate(date);
    if (classData) {
      const times = getAvailableStartTimes(date, availability, bookings, classData.durationMinutes);
      setAvailableTimes(times);
      setSelectedStartTime(null);
    }
  };

  // Handler for time selection
  const handleTimeSelect = (timeSlot: { start: Date; slot: any }) => {
    setSelectedStartTime(timeSlot);
    setCurrentStep('details');
  };

  // Handler for booking confirmation
  const handleConfirmBooking = async (notes: string = '') => {
    if (!selectedStartTime) return;
    setBookingLoading(true);
    setBookingError('');
    try {
      const token = localStorage.getItem('authToken');
      const res = await fetch('http://localhost:4000/api/bookings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          classId,
          scheduledAt: selectedStartTime.start.toISOString(),
          notes
        })
      });
      if (!res.ok) {
        const err = await res.json();
        setBookingError(err.message || 'Failed to book session.');
        setBookingLoading(false);
        return;
      }
      setBookingSuccess(true);
      setCurrentStep('confirmation');
      setCalendarRefreshKey(prev => prev + 1);
      setBookingLoading(false);
      
      // Refresh bookings for tutor view
      if (user?.userType === 'TUTOR' && user.id === classData?.tutor.id) {
        setBookingsLoading(true);
        const token = localStorage.getItem('authToken');
        fetch(`http://localhost:4000/api/bookings?classId=${classId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
          .then(res => res.json())
          .then(data => {
            setBookings(data.data || []);
            setBookingsLoading(false);
          })
          .catch(() => {
            setBookingsError('Failed to fetch bookings');
            setBookingsLoading(false);
          });
      }
      
      setTimeout(() => {
        setBookingSuccess(false);
        setCurrentStep('calendar');
        setSelectedDate(null);
        setAvailableTimes([]);
        setSelectedStartTime(null);
      }, 5000);
    } catch (e) {
      setBookingError('Failed to book session.');
      setBookingLoading(false);
    }
  };

  // Tutor scheduling handlers
  const handleTutorDateSelect = (date: Date, availability: any[], bookings: any[]) => {
    setTutorSelectedDate(date);
    if (classData) {
      const times = getAvailableStartTimes(date, availability, bookings, classData.durationMinutes);
      setTutorAvailableTimes(times);
      setTutorSelectedTime(null);
    }
  };

  const handleTutorTimeSelect = (timeSlot: { start: Date; slot: any }) => {
    setTutorSelectedTime(timeSlot);
    setTutorScheduleStep('student');
  };

  const handleTutorSchedule = async (useEmail: boolean) => {
    if (!tutorSelectedTime) return;
    setScheduleLoading(true);
    setScheduleError('');
    
    try {
      const token = localStorage.getItem('authToken');
      
      if (useEmail && studentEmail) {
        // Schedule with student email
        const response = await fetch('http://localhost:4000/api/bookings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            classId,
            scheduledAt: tutorSelectedTime.start.toISOString(),
            studentEmail,
            notes: scheduleNotes
          })
        });
        
        if (!response.ok) {
          const err = await response.json();
          setScheduleError(err.message || 'Failed to schedule session');
          setScheduleLoading(false);
          return;
        }
      } else {
        // Generate shareable link
        const response = await fetch('http://localhost:4000/api/bookings/generate-link', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            classId,
            scheduledAt: tutorSelectedTime.start.toISOString(),
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
          })
        });
        
        const result = await response.json();
        if (!response.ok) {
          setScheduleError(result.message || 'Failed to generate link');
          setScheduleLoading(false);
          return;
        }
        setShareableLink(result.data.shareableUrl);
      }
      
      setScheduleSuccess(true);
      setTutorScheduleStep('confirmation');
      setCalendarRefreshKey(prev => prev + 1);
      
      // Refresh bookings
      if (user?.userType === 'TUTOR' && user.id === classData?.tutor.id) {
        setBookingsLoading(true);
        fetch(`http://localhost:4000/api/bookings?classId=${classId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
          .then(res => res.json())
          .then(data => {
            setBookings(data.data || []);
            setBookingsLoading(false);
          })
          .catch(() => {
            setBookingsError('Failed to fetch bookings');
            setBookingsLoading(false);
          });
      }
      
      setTimeout(() => {
        setScheduleSuccess(false);
        setTutorScheduleStep('calendar');
        setTutorSelectedDate(null);
        setTutorAvailableTimes([]);
        setTutorSelectedTime(null);
        setStudentEmail('');
        setScheduleNotes('');
        setShareableLink(null);
        setShowScheduleModal(false);
      }, 5000);
    } catch (e) {
      setScheduleError('Failed to schedule session');
    } finally {
      setScheduleLoading(false);
    }
  };

  const copyScheduleLinkToClipboard = async () => {
    if (!shareableLink) return;
    try {
      await navigator.clipboard.writeText(shareableLink);
      alert('Link copied to clipboard!');
    } catch (err) {
      alert('Failed to copy link to clipboard');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#006BFF] border-t-transparent"></div>
          <p className="text-gray-600 font-medium">Loading class details...</p>
        </div>
      </div>
    );
  }

  if (error || !classData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Something went wrong</h2>
          <p className="text-gray-600 mb-6">{error || 'Class not found'}</p>
          <Link 
            href="/classes" 
            className="inline-flex items-center px-6 py-3 bg-[#006BFF] text-white font-medium rounded-lg hover:bg-[#0056CC] transition-colors duration-200"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Classes
          </Link>
        </div>
      </div>
    );
  }

  const subjectsArray = classData.tutor.subjects ? classData.tutor.subjects.split(',').map(s => s.trim()) : [];

  return (
    <div className="min-h-screen bg-white">
      {/* Success Toast */}
      {bookingSuccess && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 bg-green-600 text-white px-6 py-4 rounded-lg shadow-lg flex items-center space-x-3 animate-fade-in">
          <div className="w-6 h-6 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>
          <span className="font-medium">Booking confirmed! Check your email for details.</span>
        </div>
      )}

      {/* Tutor Schedule Modal - Calendly Style */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 bg-white">
          {/* Header */}
          <div className="bg-white border-b border-gray-200 px-8 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <button 
                  onClick={() => {
                    setShowScheduleModal(false);
                    setTutorScheduleStep('calendar');
                    setTutorSelectedDate(null);
                    setTutorAvailableTimes([]);
                    setTutorSelectedTime(null);
                    setStudentEmail('');
                    setScheduleNotes('');
                    setShareableLink(null);
                  }}
                  className="text-gray-600 hover:text-gray-900 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                </button>
                <h2 className="text-xl font-semibold text-gray-900">Schedule a Class Session</h2>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex min-h-screen">
            {/* Left Sidebar - Class Information */}
            <div className="w-80 bg-gray-50 border-r border-gray-200 p-8 flex-shrink-0">
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{classData.title}</h3>
                  <p className="text-sm text-gray-600">{classData.durationMinutes} minutes</p>
                  <p className="text-sm text-gray-600">${classData.pricePerSession} per session</p>
                </div>

                {/* Progress Steps */}
                <div className="space-y-4">
                  <div className={`flex items-center ${tutorScheduleStep === 'calendar' ? 'text-[#006BFF]' : tutorSelectedDate ? 'text-green-600' : 'text-gray-400'}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium border-2 ${
                      tutorScheduleStep === 'calendar' ? 'border-[#006BFF] bg-[#006BFF] text-white' : 
                      tutorSelectedDate ? 'border-green-600 bg-green-600 text-white' : 
                      'border-gray-300 text-gray-400'
                    }`}>
                      {tutorSelectedDate ? '✓' : '1'}
                    </div>
                    <span className="ml-3 font-medium">Select Time</span>
                  </div>
                  
                  <div className={`flex items-center ${tutorScheduleStep === 'student' ? 'text-[#006BFF]' : tutorSelectedTime ? 'text-green-600' : 'text-gray-400'}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium border-2 ${
                      tutorScheduleStep === 'student' ? 'border-[#006BFF] bg-[#006BFF] text-white' : 
                      tutorSelectedTime ? 'border-green-600 bg-green-600 text-white' : 
                      'border-gray-300 text-gray-400'
                    }`}>
                      {tutorSelectedTime ? '✓' : '2'}
                    </div>
                    <span className="ml-3 font-medium">Add Student</span>
                  </div>
                  
                  <div className={`flex items-center ${tutorScheduleStep === 'confirmation' ? 'text-green-600' : 'text-gray-400'}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium border-2 ${
                      tutorScheduleStep === 'confirmation' ? 'border-green-600 bg-green-600 text-white' : 
                      'border-gray-300 text-gray-400'
                    }`}>
                      {tutorScheduleStep === 'confirmation' ? '✓' : '3'}
                    </div>
                    <span className="ml-3 font-medium">Confirmation</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Content Area */}
            <div className="flex-1 flex flex-col">
              {tutorScheduleStep === 'calendar' && (
                <div className="p-8">
                  <div className="max-w-2xl mx-auto">
                    <div className="text-center mb-8">
                      <h2 className="text-2xl font-bold text-gray-900 mb-2">Select a date & time</h2>
                      <p className="text-gray-600">Choose when you want to schedule this session</p>
                    </div>
                    
                    <div className="bg-white">
                      <TutorBookingCalendar 
                        tutorId={classData.tutor.id} 
                        userType="TUTOR"
                        durationMinutes={classData.durationMinutes} 
                        classId={classData.id}
                        onDateSelect={handleTutorDateSelect}
                        onSlotSelect={handleTutorTimeSelect}
                        calendarRefreshKey={calendarRefreshKey}
                      />
                    </div>
                  </div>
                </div>
              )}

              {tutorScheduleStep === 'student' && tutorSelectedTime && (
                <div className="p-8">
                  <div className="max-w-lg mx-auto">
                    <div className="text-center mb-8">
                      <h2 className="text-2xl font-bold text-gray-900 mb-2">Add Student Details</h2>
                      <p className="text-gray-600">Choose how to invite the student to this session</p>
                    </div>

                    {/* Selected Time Summary */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold text-gray-900">{classData.title}</h3>
                          <p className="text-sm text-gray-600">
                            {tutorSelectedTime.start.toLocaleDateString()} at {tutorSelectedTime.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                          <p className="text-sm text-gray-600">{classData.durationMinutes} minutes</p>
                        </div>
                        <button
                          onClick={() => {
                            setTutorScheduleStep('calendar');
                            setTutorSelectedTime(null);
                          }}
                          className="text-[#006BFF] hover:text-[#0056CC] font-medium text-sm"
                        >
                          Change
                        </button>
                      </div>
                    </div>

                    {/* Student Options */}
                    <div className="space-y-6">
                      {/* Option 1: Add Student Email */}
                      <div className="border border-gray-200 rounded-lg p-6">
                        <h3 className="font-semibold text-gray-900 mb-4">Option 1: Add Student Email</h3>
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Student Email
                            </label>
                            <input
                              type="email"
                              value={studentEmail}
                              onChange={(e) => setStudentEmail(e.target.value)}
                              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#006BFF] focus:border-[#006BFF] transition-colors"
                              placeholder="student@example.com"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Notes (optional)
                            </label>
                            <textarea
                              value={scheduleNotes}
                              onChange={(e) => setScheduleNotes(e.target.value)}
                              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#006BFF] focus:border-[#006BFF] transition-colors resize-none"
                              rows={3}
                              placeholder="Add any notes for the student..."
                            />
                          </div>
                          <button
                            onClick={() => handleTutorSchedule(true)}
                            disabled={scheduleLoading || !studentEmail}
                            className="w-full px-6 py-3 bg-[#006BFF] text-white rounded-lg font-medium hover:bg-[#0056CC] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {scheduleLoading ? 'Scheduling...' : 'Schedule with Email'}
                          </button>
                        </div>
                      </div>

                      {/* Option 2: Generate Shareable Link */}
                      <div className="border border-gray-200 rounded-lg p-6">
                        <h3 className="font-semibold text-gray-900 mb-4">Option 2: Generate Shareable Link</h3>
                        <p className="text-sm text-gray-600 mb-4">
                          Create a shareable link that students can use to book this session themselves.
                        </p>
                        <button
                          onClick={() => handleTutorSchedule(false)}
                          disabled={scheduleLoading}
                          className="w-full px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {scheduleLoading ? 'Generating...' : 'Generate Shareable Link'}
                        </button>
                      </div>
                    </div>

                    {scheduleError && (
                      <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg border border-red-200 mt-4">
                        {scheduleError}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {tutorScheduleStep === 'confirmation' && (
                <div className="p-8">
                  <div className="max-w-lg mx-auto text-center">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                      <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    
                    <h2 className="text-2xl font-bold text-gray-900 mb-4">Session Scheduled!</h2>
                    <p className="text-gray-600 mb-8">
                      {shareableLink 
                        ? 'Your shareable link has been generated. Share it with students to let them book this session.'
                        : 'The session has been scheduled and the student will receive an email invitation.'
                      }
                    </p>

                    {tutorSelectedTime && (
                      <div className="bg-gray-50 rounded-lg p-6 mb-8 text-left">
                        <h3 className="font-semibold text-gray-900 mb-4">Session Details</h3>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Class:</span>
                            <span className="font-medium">{classData.title}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Date:</span>
                            <span className="font-medium">{tutorSelectedTime.start.toLocaleDateString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Time:</span>
                            <span className="font-medium">
                              {tutorSelectedTime.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Duration:</span>
                            <span className="font-medium">{classData.durationMinutes} minutes</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {shareableLink && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8">
                        <h3 className="font-semibold text-gray-900 mb-2">Shareable Link</h3>
                        <div className="flex items-center space-x-2">
                          <input
                            type="text"
                            value={shareableLink}
                            readOnly
                            className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm bg-white"
                          />
                          <button
                            onClick={copyScheduleLinkToClipboard}
                            className="px-4 py-2 bg-[#006BFF] text-white rounded text-sm hover:bg-[#0056CC] transition-colors"
                          >
                            Copy
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="space-y-4">
                      <button
                        onClick={() => {
                          setShowScheduleModal(false);
                          setTutorScheduleStep('calendar');
                          setTutorSelectedDate(null);
                          setTutorAvailableTimes([]);
                          setTutorSelectedTime(null);
                          setStudentEmail('');
                          setScheduleNotes('');
                          setShareableLink(null);
                        }}
                        className="block w-full px-6 py-3 bg-[#006BFF] text-white rounded-lg font-medium hover:bg-[#0056CC] transition-colors"
                      >
                        Schedule Another Session
                      </button>
                      <button
                        onClick={() => {
                          setShowScheduleModal(false);
                          setTutorScheduleStep('calendar');
                          setTutorSelectedDate(null);
                          setTutorAvailableTimes([]);
                          setTutorSelectedTime(null);
                          setStudentEmail('');
                          setScheduleNotes('');
                          setShareableLink(null);
                        }}
                        className="block w-full px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                      >
                        Done
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Container - Calendly Style Layout */}
      <div className="flex min-h-screen">
        {/* Left Sidebar - Class Information (Calendly style) */}
        <div className="w-80 bg-gray-50 border-r border-gray-200 p-8 flex-shrink-0">
          {/* Back Button */}
          <Link 
            href="/classes" 
            className="inline-flex items-center text-gray-600 hover:text-gray-900 font-medium transition-colors mb-8"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Classes
          </Link>

          {/* Tutor Info */}
          <div className="mb-8">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-[#006BFF] to-[#0056CC] rounded-full flex items-center justify-center text-white font-semibold text-lg">
                {classData.tutor.firstName[0]}{classData.tutor.lastName[0]}
              </div>
              <div className="ml-3">
                <h3 className="font-semibold text-gray-900 text-lg">
                  {classData.tutor.firstName} {classData.tutor.lastName}
                </h3>
                <p className="text-gray-600 text-sm">Tutor</p>
              </div>
            </div>
          </div>

          {/* Class Details */}
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-3">{classData.title}</h1>
              {classData.description && (
                <p className="text-gray-600 text-sm leading-relaxed mb-4">{classData.description}</p>
              )}
            </div>

            {/* Class Info Pills */}
            <div className="space-y-3">
              <div className="flex items-center text-sm">
                <svg className="w-4 h-4 text-gray-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-gray-600">{classData.durationMinutes} minutes</span>
              </div>
              
              <div className="flex items-center text-sm">
                <svg className="w-4 h-4 text-gray-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
                <span className="text-gray-600">${classData.pricePerSession} per session</span>
              </div>

              <div className="flex items-center text-sm">
                <svg className="w-4 h-4 text-gray-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                <span className="text-gray-600">{classData.subject}</span>
                {classData.level && (
                  <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                    {classData.level}
                  </span>
                )}
              </div>

              <div className="flex items-center text-sm">
                <svg className="w-4 h-4 text-gray-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <span className="text-gray-600">Max {classData.maxStudents} students</span>
              </div>
            </div>

            {/* Subjects */}
            {subjectsArray.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">Subjects</h4>
                <div className="flex flex-wrap gap-2">
                  {subjectsArray.map((subject, index) => (
                    <span 
                      key={index}
                      className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-700"
                    >
                      {subject}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Tutor Actions (if applicable) */}
            {user?.userType === 'TUTOR' && user.id === classData.tutor.id && (
              <div className="space-y-3 pt-6 border-t border-gray-200">
                <button
                  onClick={() => setShowScheduleModal(true)}
                  className="w-full flex items-center justify-center px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Schedule Class
                </button>
                <button
                  onClick={generateShareableLink}
                  disabled={generatingLink}
                  className="w-full flex items-center justify-center px-4 py-2 bg-[#006BFF] text-white font-medium rounded-lg hover:bg-[#0056CC] transition-colors disabled:opacity-50"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
                  </svg>
                  {generatingLink ? 'Generating...' : 'Share Link'}
                </button>
                {shareableLink && (
                  <div className="flex items-center space-x-2 bg-gray-100 px-3 py-2 rounded-lg">
                    <span className="text-sm text-gray-700 truncate flex-1">{shareableLink}</span>
                    <button 
                      onClick={copyToClipboard} 
                      className="text-[#006BFF] hover:text-[#0056CC] transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                  </div>
                )}
                <Link
                  href={`/classes/${classId}/edit`}
                  className="w-full flex items-center justify-center px-4 py-2 bg-gray-600 text-white font-medium rounded-lg hover:bg-gray-700 transition-colors"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Edit Class
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Right Content Area - Booking Flow */}
        <div className="flex-1 flex flex-col">
          {/* Progress Indicator (Calendly style) */}
          {user?.userType === 'STUDENT' && classData.isActive && (
            <div className="bg-white border-b border-gray-200 px-8 py-4">
              <div className="flex items-center space-x-8">
                <div className={`flex items-center ${currentStep === 'calendar' ? 'text-[#006BFF]' : selectedDate ? 'text-green-600' : 'text-gray-400'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium border-2 ${
                    currentStep === 'calendar' ? 'border-[#006BFF] bg-[#006BFF] text-white' : 
                    selectedDate ? 'border-green-600 bg-green-600 text-white' : 
                    'border-gray-300 text-gray-400'
                  }`}>
                    {selectedDate ? '✓' : '1'}
                  </div>
                  <span className="ml-3 font-medium">Select Time</span>
                </div>
                
                <div className={`flex items-center ${currentStep === 'details' ? 'text-[#006BFF]' : selectedStartTime ? 'text-green-600' : 'text-gray-400'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium border-2 ${
                    currentStep === 'details' ? 'border-[#006BFF] bg-[#006BFF] text-white' : 
                    selectedStartTime ? 'border-green-600 bg-green-600 text-white' : 
                    'border-gray-300 text-gray-400'
                  }`}>
                    {selectedStartTime ? '✓' : '2'}
                  </div>
                  <span className="ml-3 font-medium">Enter Details</span>
                </div>
                
                <div className={`flex items-center ${currentStep === 'confirmation' ? 'text-green-600' : 'text-gray-400'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium border-2 ${
                    currentStep === 'confirmation' ? 'border-green-600 bg-green-600 text-white' : 
                    'border-gray-300 text-gray-400'
                  }`}>
                    {currentStep === 'confirmation' ? '✓' : '3'}
                  </div>
                  <span className="ml-3 font-medium">Confirmation</span>
                </div>
              </div>
            </div>
          )}

          {/* Main Content */}
          <div className="flex-1 bg-white">
            {!classData.isActive ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center py-16">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">This class is currently inactive</h3>
                  <p className="text-gray-500">Please check back later or contact the tutor.</p>
                </div>
              </div>
            ) : user?.userType === 'TUTOR' && user.id === classData.tutor.id ? (
              /* Tutor Dashboard */
              <div className="p-8">
                <div className="max-w-4xl mx-auto">
                  <h2 className="text-2xl font-bold text-gray-900 mb-8">Manage Your Class</h2>
                  
                  {/* Bookings Table for Tutor */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100">
                      <h3 className="text-lg font-semibold text-gray-900">Recent Bookings</h3>
                    </div>
                    <div className="p-6">
                      {bookingsLoading ? (
                        <div className="flex items-center justify-center py-8">
                          <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#006BFF] border-t-transparent"></div>
                          <span className="ml-3 text-gray-600">Loading bookings...</span>
                        </div>
                      ) : bookingsError ? (
                        <div className="text-red-600 bg-red-50 p-4 rounded-lg">{bookingsError}</div>
                      ) : bookings.length === 0 ? (
                        <div className="text-center py-8">
                          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                          <p className="text-gray-500">No bookings yet.</p>
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead>
                              <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Scheduled At</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-100">
                              {bookings.map(b => (
                                <tr key={b.id} className="hover:bg-gray-50 transition-colors">
                                  <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                    {b.student?.firstName} {b.student?.lastName}
                                  </td>
                                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {new Date(b.scheduledAt).toLocaleString()}
                                  </td>
                                  <td className="px-4 py-4 whitespace-nowrap">
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                      b.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                                      b.status === 'CONFIRMED' ? 'bg-green-100 text-green-800' :
                                      b.status === 'CANCELLED' ? 'bg-red-100 text-red-800' :
                                      'bg-gray-100 text-gray-800'
                                    }`}>
                                      {b.status}
                                    </span>
                                  </td>
                                  <td className="px-4 py-4 whitespace-nowrap text-sm">
                                    {b.status === 'PENDING' && (
                                      <div className="flex space-x-2">
                                        <button
                                          className="inline-flex items-center px-3 py-1 bg-green-600 text-white text-xs font-medium rounded-md hover:bg-green-700 transition-colors"
                                          onClick={async () => {
                                            const token = localStorage.getItem('authToken');
                                            await fetch(`http://localhost:4000/api/bookings/${b.id}/status`, {
                                              method: 'PATCH',
                                              headers: {
                                                'Content-Type': 'application/json',
                                                'Authorization': `Bearer ${token}`
                                              },
                                              body: JSON.stringify({ status: 'CONFIRMED' })
                                            });
                                            setBookings(bookings => bookings.map(book => book.id === b.id ? { ...book, status: 'CONFIRMED' } : book));
                                            setCalendarRefreshKey(prev => prev + 1);
                                          }}
                                        >
                                          <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                          </svg>
                                          Approve
                                        </button>
                                        <button
                                          className="inline-flex items-center px-3 py-1 bg-red-600 text-white text-xs font-medium rounded-md hover:bg-red-700 transition-colors"
                                          onClick={async () => {
                                            const token = localStorage.getItem('authToken');
                                            await fetch(`http://localhost:4000/api/bookings/${b.id}/status`, {
                                              method: 'PATCH',
                                              headers: {
                                                'Content-Type': 'application/json',
                                                'Authorization': `Bearer ${token}`
                                              },
                                              body: JSON.stringify({ status: 'CANCELLED' })
                                            });
                                            setBookings(bookings => bookings.map(book => book.id === b.id ? { ...book, status: 'CANCELLED' } : book));
                                            setCalendarRefreshKey(prev => prev + 1);
                                          }}
                                        >
                                          <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                          </svg>
                                          Reject
                                        </button>
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* Student Booking Flow */
              <div className="flex-1">
                {currentStep === 'calendar' && (
                  <div className="p-8">
                    <div className="max-w-2xl mx-auto">
                      <div className="text-center mb-8">
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">Select a date & time</h2>
                        <p className="text-gray-600">Choose your preferred time slot for the session</p>
                      </div>
                      
                      <div className="bg-white">
                        <TutorBookingCalendar 
                          tutorId={classData.tutor.id} 
                          userType={user?.userType} 
                          durationMinutes={classData.durationMinutes} 
                          classId={classData.id}
                          onDateSelect={handleDateSelect}
                          onSlotSelect={handleTimeSelect}
                          calendarRefreshKey={calendarRefreshKey}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {currentStep === 'details' && selectedStartTime && (
                  <div className="p-8">
                    <div className="max-w-lg mx-auto">
                      <div className="text-center mb-8">
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">Enter your details</h2>
                        <p className="text-gray-600">We'll send you booking details and reminders</p>
                      </div>

                      {/* Selected Time Summary */}
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-semibold text-gray-900">{classData.title}</h3>
                            <p className="text-sm text-gray-600">
                              {selectedStartTime.start.toLocaleDateString()} at {selectedStartTime.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                            <p className="text-sm text-gray-600">{classData.durationMinutes} minutes</p>
                          </div>
                          <button
                            onClick={() => {
                              setCurrentStep('calendar');
                              setSelectedStartTime(null);
                            }}
                            className="text-[#006BFF] hover:text-[#0056CC] font-medium text-sm"
                          >
                            Change
                          </button>
                        </div>
                      </div>

                      {/* Booking Form */}
                      <form onSubmit={(e) => {
                        e.preventDefault();
                        const formData = new FormData(e.currentTarget);
                        const notes = formData.get('notes') as string;
                        handleConfirmBooking(notes);
                      }}>
                        <div className="space-y-6">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Additional notes (optional)
                            </label>
                            <textarea
                              name="notes"
                              rows={4}
                              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#006BFF] focus:border-[#006BFF] transition-colors resize-none"
                              placeholder="Let the tutor know about any specific requirements or questions..."
                            />
                          </div>

                          {bookingError && (
                            <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg border border-red-200">
                              {bookingError}
                            </div>
                          )}

                          <div className="flex space-x-4">
                            <button
                              type="button"
                              onClick={() => {
                                setCurrentStep('calendar');
                                setSelectedStartTime(null);
                              }}
                              className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                            >
                              Back
                            </button>
                            <button
                              type="submit"
                              disabled={bookingLoading}
                              className="flex-1 px-6 py-3 bg-[#006BFF] text-white rounded-lg font-medium hover:bg-[#0056CC] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {bookingLoading ? (
                                <div className="flex items-center justify-center">
                                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                                  Booking...
                                </div>
                              ) : (
                                'Confirm Booking'
                              )}
                            </button>
                          </div>
                        </div>
                      </form>
                    </div>
                  </div>
                )}

                {currentStep === 'confirmation' && (
                  <div className="p-8">
                    <div className="max-w-lg mx-auto text-center">
                      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      
                      <h2 className="text-2xl font-bold text-gray-900 mb-4">Booking Confirmed!</h2>
                      <p className="text-gray-600 mb-8">
                        Your session has been successfully booked. You'll receive a confirmation email with all the details shortly.
                      </p>

                      {selectedStartTime && (
                        <div className="bg-gray-50 rounded-lg p-6 mb-8 text-left">
                          <h3 className="font-semibold text-gray-900 mb-4">Session Details</h3>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-600">Class:</span>
                              <span className="font-medium">{classData.title}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Date:</span>
                              <span className="font-medium">{selectedStartTime.start.toLocaleDateString()}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Time:</span>
                              <span className="font-medium">
                                {selectedStartTime.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Duration:</span>
                              <span className="font-medium">{classData.durationMinutes} minutes</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Tutor:</span>
                              <span className="font-medium">{classData.tutor.firstName} {classData.tutor.lastName}</span>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="space-y-4">
                        <Link
                          href="/bookings"
                          className="block w-full px-6 py-3 bg-[#006BFF] text-white rounded-lg font-medium hover:bg-[#0056CC] transition-colors"
                        >
                          View My Bookings
                        </Link>
                        <Link
                          href="/classes"
                          className="block w-full px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                        >
                          Browse More Classes
                        </Link>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}