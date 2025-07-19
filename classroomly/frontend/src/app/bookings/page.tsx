"use client";
import { useState, useEffect } from 'react';
import Link from 'next/link';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';

interface Booking {
  id: string;
  scheduledAt: string;
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';
  notes?: string;
  createdAt: string;
  class: {
    id: string;
    title: string;
    subject: string;
    durationMinutes: number;
    pricePerSession: number;
    tutor?: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
    };
  };
  student?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

interface User {
  id: string;
  userType: 'TUTOR' | 'STUDENT';
}

type ViewMode = 'list' | 'calendar';

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

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

    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch('http://localhost:4000/api/bookings', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const result = await response.json();

      if (response.ok) {
        setBookings(result.data);
      } else {
        setError(result.message || 'Failed to fetch bookings');
      }
    } catch {
      setError('An error occurred while fetching bookings');
    } finally {
      setLoading(false);
    }
  };

  const updateBookingStatus = async (bookingId: string, status: Booking["status"]) => {
    setUpdatingStatus(bookingId);
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`http://localhost:4000/api/bookings/${bookingId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      });

      const result = await response.json();

      if (response.ok) {
        // Update the booking in the list
        setBookings(bookings.map(booking => 
          booking.id === bookingId 
            ? { ...booking, status: status }
            : booking
        ));
        
        // Dispatch custom event to notify dashboard of booking status change
        window.dispatchEvent(new CustomEvent('bookingStatusChanged', {
          detail: { bookingId, status }
        }));
      } else {
        alert(result.message || 'Failed to update booking status');
      }
    } catch {
      alert('An error occurred while updating the booking');
    } finally {
      setUpdatingStatus(null);
    }
  };

  const cancelBooking = async (bookingId: string) => {
    if (!confirm('Are you sure you want to cancel this booking?')) {
      return;
    }

    setUpdatingStatus(bookingId);
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`http://localhost:4000/api/bookings/${bookingId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const result = await response.json();

      if (response.ok) {
        // Remove the booking from the list
        setBookings(bookings.filter(booking => booking.id !== bookingId));
        
        // Dispatch custom event to notify dashboard of booking deletion
        window.dispatchEvent(new CustomEvent('bookingDeleted', {
          detail: { bookingId }
        }));
      } else {
        alert(result.message || 'Failed to cancel booking');
      }
    } catch {
      alert('An error occurred while cancelling the booking');
    } finally {
      setUpdatingStatus(null);
    }
  };

  const startClass = async (bookingId: string) => {
    const booking = bookings.find(b => b.id === bookingId);
    if (!booking) return;

    const scheduledTime = new Date(booking.scheduledAt);
    const now = new Date();
    const timeDiff = (now.getTime() - scheduledTime.getTime()) / (1000 * 60); // minutes

    let confirmMessage = 'Are you ready to start this class session?';
    
    if (timeDiff < 0) {
      confirmMessage = `This session is scheduled for ${formatDateTime(booking.scheduledAt)}. You're starting ${Math.abs(Math.round(timeDiff))} minutes early. Continue?`;
    } else if (timeDiff > 0) {
      confirmMessage = `This session was scheduled for ${formatDateTime(booking.scheduledAt)}. You're starting ${Math.round(timeDiff)} minutes late. Continue?`;
    }

    if (!confirm(confirmMessage)) {
      return;
    }

    setUpdatingStatus(bookingId);
    try {
      const token = localStorage.getItem('authToken');
      // 1. Try to fetch existing session for this booking
      const fetchSessionRes = await fetch(`http://localhost:4000/api/sessions/by-booking/${bookingId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (fetchSessionRes.ok) {
        const sessionResult = await fetchSessionRes.json();
        if (sessionResult.data && sessionResult.data.id) {
          // If session is completed or cancelled, restart it first
          if (sessionResult.data.status === 'COMPLETED' || sessionResult.data.status === 'CANCELLED') {
            const restartRes = await fetch(`http://localhost:4000/api/sessions/${sessionResult.data.id}/restart`, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!restartRes.ok) {
              const result = await restartRes.json();
              throw new Error(result.message || 'Failed to restart session');
            }
          }
          window.location.href = `/session/${sessionResult.data.id}`;
          setUpdatingStatus(null);
          return;
        }
      }
      // 2. If not found, create a new session
      const createSessionResponse = await fetch('http://localhost:4000/api/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ bookingId })
      });
      if (!createSessionResponse.ok) {
        const result = await createSessionResponse.json();
        throw new Error(result.message || 'Failed to create session');
      }
      const sessionResult = await createSessionResponse.json();
      const sessionId = sessionResult.data.id;
      window.location.href = `/session/${sessionId}`;
    } catch (error) {
      console.error('Error starting class:', error);
      alert(error instanceof Error ? error.message : 'An error occurred while starting the class');
    } finally {
      setUpdatingStatus(null);
    }
  };

  const joinClass = async (bookingId: string) => {
    const booking = bookings.find(b => b.id === bookingId);
    if (!booking) return;

    const scheduledTime = new Date(booking.scheduledAt);
    const now = new Date();
    const timeDiff = (now.getTime() - scheduledTime.getTime()) / (1000 * 60); // minutes

    let confirmMessage = 'Are you ready to join this class session?';
    
    if (timeDiff < 0) {
      confirmMessage = `This session is scheduled for ${formatDateTime(booking.scheduledAt)}. You're joining ${Math.abs(Math.round(timeDiff))} minutes early. Continue?`;
    } else if (timeDiff > 0) {
      confirmMessage = `This session was scheduled for ${formatDateTime(booking.scheduledAt)}. You're joining ${Math.round(timeDiff)} minutes late. Continue?`;
    }

    if (!confirm(confirmMessage)) {
      return;
    }

    setUpdatingStatus(bookingId);
    try {
      const token = localStorage.getItem('authToken');
      // 1. Try to fetch existing session for this booking
      const fetchSessionRes = await fetch(`http://localhost:4000/api/sessions/by-booking/${bookingId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (fetchSessionRes.ok) {
        const sessionResult = await fetchSessionRes.json();
        if (sessionResult.data && sessionResult.data.id) {
          // If session is completed or cancelled, restart it first
          if (sessionResult.data.status === 'COMPLETED' || sessionResult.data.status === 'CANCELLED') {
            const restartRes = await fetch(`http://localhost:4000/api/sessions/${sessionResult.data.id}/restart`, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!restartRes.ok) {
              const result = await restartRes.json();
              throw new Error(result.message || 'Failed to restart session');
            }
          }
          window.location.href = `/session/${sessionResult.data.id}`;
          setUpdatingStatus(null);
          return;
        }
      }
      // 2. If not found, create a new session
      const createSessionResponse = await fetch('http://localhost:4000/api/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ bookingId })
      });
      if (!createSessionResponse.ok) {
        const result = await createSessionResponse.json();
        throw new Error(result.message || 'Failed to create session');
      }
      const sessionResult = await createSessionResponse.json();
      const sessionId = sessionResult.data.id;
      window.location.href = `/session/${sessionId}`;
    } catch (error) {
      console.error('Error joining class:', error);
      alert(error instanceof Error ? error.message : 'An error occurred while joining the class');
    } finally {
      setUpdatingStatus(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800';
      case 'CONFIRMED':
        return 'bg-green-100 text-green-800';
      case 'CANCELLED':
        return 'bg-red-100 text-red-800';
      case 'COMPLETED':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Calendar tile content: highlight days with bookings
  const tileClassName = ({ date }: { date: Date }) => {
    const dayBookings = bookings.filter(booking => {
      const bookingDate = new Date(booking.scheduledAt);
      return bookingDate.toDateString() === date.toDateString();
    });
    
    if (dayBookings.length > 0) {
      return 'react-calendar__tile--has-bookings cursor-pointer';
    }
    return '';
  };

  const tileContent = ({ date }: { date: Date }) => {
    const dayBookings = bookings.filter(booking => {
      const bookingDate = new Date(booking.scheduledAt);
      return bookingDate.toDateString() === date.toDateString();
    });
    
    if (dayBookings.length > 0) {
      const confirmedBookings = dayBookings.filter(b => b.status === 'CONFIRMED').length;
      const pendingBookings = dayBookings.filter(b => b.status === 'PENDING').length;
      
      return (
        <div className="flex flex-col items-center space-y-1">
          <div className="text-xs font-bold text-blue-600">
            {dayBookings.length}
          </div>
          {confirmedBookings > 0 && (
            <div className="flex space-x-1">
              {confirmedBookings > 0 && (
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
              )}
              {pendingBookings > 0 && (
                <div className="w-1.5 h-1.5 bg-yellow-500 rounded-full"></div>
              )}
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  const getBookingsForDate = (date: Date) => {
    return bookings.filter(booking => {
      const bookingDate = new Date(booking.scheduledAt);
      return bookingDate.toDateString() === date.toDateString();
    });
  };

  const canStartSession = (booking: Booking) => {
    // Can start anytime - no time restrictions
    return true;
  };

  const getSessionTimingStatus = (booking: Booking) => {
    const scheduledTime = new Date(booking.scheduledAt);
    const now = new Date();
    const timeDiff = (now.getTime() - scheduledTime.getTime()) / (1000 * 60); // minutes
    
    if (timeDiff < 0) {
      return { status: 'early', message: `${Math.abs(Math.round(timeDiff))} min early` };
    } else if (timeDiff < 5) {
      return { status: 'on-time', message: 'On time' };
    } else {
      return { status: 'late', message: `${Math.round(timeDiff)} min late` };
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Error</h2>
          <p className="text-red-600 mb-4">{error}</p>
          <button 
            onClick={fetchBookings}
            className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <Link href="/dashboard" className="text-blue-600 hover:text-blue-500 mr-4">
                ← Back to Dashboard
              </Link>
              <h1 className="text-2xl font-bold text-gray-900">
                {user?.userType === 'TUTOR' ? 'My Class Bookings' : 'My Bookings'}
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              {user?.userType === 'TUTOR' && (
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setViewMode('list')}
                    className={`px-3 py-2 text-sm font-medium rounded-md ${
                      viewMode === 'list'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    List View
                  </button>
                  <button
                    onClick={() => setViewMode('calendar')}
                    className={`px-3 py-2 text-sm font-medium rounded-md ${
                      viewMode === 'calendar'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    Calendar View
                  </button>
                </div>
              )}
              {user?.userType === 'STUDENT' && (
                <Link
                  href="/classes"
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                >
                  Browse Classes
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Session Flexibility Info */}
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-800">
                  Flexible Session Timing
                </h3>
                <div className="mt-2 text-sm text-blue-700">
                  <p>
                    Sessions can be started anytime before, during, or after the scheduled time. 
                    Completed sessions can also be restarted for review or additional practice.
                  </p>
                </div>
              </div>
            </div>
          </div>
          {bookings.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-400 mb-4">
                <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {user?.userType === 'TUTOR' ? 'No bookings yet' : 'No bookings yet'}
              </h3>
              <p className="text-gray-500 mb-6">
                {user?.userType === 'TUTOR' 
                  ? 'When students book your classes, they will appear here.'
                  : 'Start by browsing available classes and making your first booking.'
                }
              </p>
              {user?.userType === 'STUDENT' && (
                <Link
                  href="/classes"
                  className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
                >
                  Browse Classes
                </Link>
              )}
            </div>
          ) : viewMode === 'list' ? (
            <div className="animate-fadeIn">
              {/* List View */}
              <div className="grid gap-6">
                {bookings.map((booking) => (
                  <div key={booking.id} className="bg-white shadow rounded-lg">
                    <div className="px-6 py-4">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="text-lg font-medium text-gray-900">
                            {booking.class.title}
                          </h3>
                          <p className="text-gray-500">{booking.class.subject}</p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(booking.status)}`}>
                            {booking.status}
                          </span>
                          {user?.userType === 'TUTOR' && booking.status === 'PENDING' && (
                            <div className="flex space-x-1">
                              <button
                                onClick={() => updateBookingStatus(booking.id, 'CONFIRMED')}
                                disabled={updatingStatus === booking.id}
                                className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                              >
                                {updatingStatus === booking.id ? '...' : 'Approve'}
                              </button>
                              <button
                                onClick={() => updateBookingStatus(booking.id, 'CANCELLED')}
                                disabled={updatingStatus === booking.id}
                                className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                              >
                                {updatingStatus === booking.id ? '...' : 'Reject'}
                              </button>
                            </div>
                          )}
                          {user?.userType === 'STUDENT' && booking.status === 'PENDING' && (
                            <button
                              onClick={() => cancelBooking(booking.id)}
                              disabled={updatingStatus === booking.id}
                              className="px-2 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700 disabled:opacity-50"
                            >
                              {updatingStatus === booking.id ? '...' : 'Cancel'}
                            </button>
                          )}
                                                  {user?.userType === 'TUTOR' && (booking.status === 'CONFIRMED' || booking.status === 'COMPLETED') && (
                          <div className="flex flex-col items-end space-y-1">
                            <button
                              onClick={() => startClass(booking.id)}
                              disabled={updatingStatus === booking.id}
                              className="px-3 py-1 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-all duration-200 hover:scale-105"
                            >
                              {updatingStatus === booking.id ? (
                                <div className="flex items-center">
                                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1"></div>
                                  Starting...
                                </div>
                              ) : (
                                booking.status === 'COMPLETED' ? 'Restart Class' : 'Start Class'
                              )}
                            </button>
                            <span className={`text-xs px-2 py-1 rounded-full ${
                              getSessionTimingStatus(booking).status === 'early' ? 'bg-yellow-100 text-yellow-700' :
                              getSessionTimingStatus(booking).status === 'on-time' ? 'bg-green-100 text-green-700' :
                              'bg-red-100 text-red-700'
                            }`}>
                              {getSessionTimingStatus(booking).message}
                            </span>
                          </div>
                        )}
                                                  {user?.userType === 'STUDENT' && (booking.status === 'CONFIRMED' || booking.status === 'COMPLETED') && (
                          <div className="flex flex-col items-end space-y-1">
                            <button
                              onClick={() => joinClass(booking.id)}
                              disabled={updatingStatus === booking.id}
                              className="px-3 py-1 text-xs bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-all duration-200 hover:scale-105"
                            >
                              {updatingStatus === booking.id ? (
                                <div className="flex items-center">
                                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1"></div>
                                  Joining...
                                </div>
                              ) : (
                                booking.status === 'COMPLETED' ? 'Rejoin Class' : 'Join Class'
                              )}
                            </button>
                            <span className={`text-xs px-2 py-1 rounded-full ${
                              getSessionTimingStatus(booking).status === 'early' ? 'bg-yellow-100 text-yellow-700' :
                              getSessionTimingStatus(booking).status === 'on-time' ? 'bg-green-100 text-green-700' :
                              'bg-red-100 text-red-700'
                            }`}>
                              {getSessionTimingStatus(booking).message}
                            </span>
                          </div>
                        )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <h4 className="text-sm font-medium text-gray-900 mb-2">Session Details</h4>
                          <dl className="space-y-1">
                            <div className="flex justify-between">
                              <dt className="text-gray-500">Date & Time:</dt>
                              <dd className="font-medium">{formatDateTime(booking.scheduledAt)}</dd>
                            </div>
                            <div className="flex justify-between">
                              <dt className="text-gray-500">Duration:</dt>
                              <dd className="font-medium">{booking.class.durationMinutes} minutes</dd>
                            </div>
                            <div className="flex justify-between">
                              <dt className="text-gray-500">Price:</dt>
                              <dd className="font-medium">${booking.class.pricePerSession}</dd>
                            </div>
                          </dl>
                        </div>

                        <div>
                          <h4 className="text-sm font-medium text-gray-900 mb-2">
                            {user?.userType === 'TUTOR' ? 'Student' : 'Tutor'}
                          </h4>
                          {user?.userType === 'TUTOR' && booking.student ? (
                            <div>
                              <p className="font-medium">{booking.student.firstName} {booking.student.lastName}</p>
                              <p className="text-gray-500">{booking.student.email}</p>
                            </div>
                          ) : user?.userType === 'STUDENT' && booking.class.tutor ? (
                            <div>
                              <p className="font-medium">{booking.class.tutor.firstName} {booking.class.tutor.lastName}</p>
                              <p className="text-gray-500">{booking.class.tutor.email}</p>
                            </div>
                          ) : null}
                        </div>
                      </div>

                      {booking.notes && (
                        <div className="mt-4">
                          <h4 className="text-sm font-medium text-gray-900 mb-2">Notes</h4>
                          <p className="text-gray-600 text-sm">{booking.notes}</p>
                        </div>
                      )}

                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <div className="flex justify-between items-center text-sm text-gray-500">
                          <span>Booked on {formatDateTime(booking.createdAt)}</span>
                          <Link
                            href={`/classes/${booking.class.id}`}
                            className="text-blue-600 hover:text-blue-500"
                          >
                            View Class Details
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            // Calendar View
            <div className="animate-fadeIn">
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                {/* Calendar */}
                <div className="xl:col-span-1">
                  <div className="bg-white shadow-lg rounded-xl p-8 sticky top-6">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-xl font-bold text-gray-900">Calendar</h3>
                      <div className="flex items-center space-x-2">
                        <span className="inline-flex items-center text-sm text-gray-600">
                          <span className="w-3 h-3 bg-blue-500 rounded-full mr-2 animate-pulse"></span>
                          Days with bookings
                        </span>
                      </div>
                    </div>
                    
                    <div className="calendar-container">
                      <Calendar
                        onChange={(value) => {
                          if (value instanceof Date) {
                            setSelectedDate(value);
                            // Add a subtle animation effect
                            const calendarElement = document.querySelector('.calendar-container') as HTMLElement;
                            if (calendarElement) {
                              calendarElement.style.transform = 'scale(1.02)';
                              setTimeout(() => {
                                calendarElement.style.transform = 'scale(1)';
                              }, 150);
                            }
                          }
                        }}
                        value={selectedDate}
                        tileClassName={tileClassName}
                        tileContent={tileContent}
                        className="w-full calendar-enhanced"
                        minDetail="month"
                        maxDetail="month"
                        showNavigation={true}
                        showNeighboringMonth={false}
                      />
                    </div>
                    
                    {/* Quick Stats */}
                    <div className="mt-6 pt-6 border-t border-gray-100">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="text-center p-3 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors duration-200">
                          <div className="text-2xl font-bold text-blue-600">
                            {bookings.filter(b => b.status === 'CONFIRMED').length}
                          </div>
                          <div className="text-xs text-blue-600 font-medium">Confirmed</div>
                        </div>
                        <div className="text-center p-3 bg-yellow-50 rounded-lg hover:bg-yellow-100 transition-colors duration-200">
                          <div className="text-2xl font-bold text-yellow-600">
                            {bookings.filter(b => b.status === 'PENDING').length}
                          </div>
                          <div className="text-xs text-yellow-600 font-medium">Pending</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bookings for selected date */}
                <div className="xl:col-span-1">
                  <div className="bg-white shadow-lg rounded-xl p-8">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-xl font-bold text-gray-900">
                        {selectedDate 
                          ? `Bookings for ${selectedDate.toLocaleDateString('en-US', { 
                              weekday: 'long', 
                              year: 'numeric', 
                              month: 'long', 
                              day: 'numeric' 
                            })}`
                          : 'Select a date to view bookings'
                        }
                      </h3>
                      {selectedDate && (
                        <div className="text-sm text-gray-500 bg-gray-50 px-3 py-1 rounded-full">
                          {getBookingsForDate(selectedDate).length} booking{getBookingsForDate(selectedDate).length !== 1 ? 's' : ''}
                        </div>
                      )}
                    </div>
                    
                    {selectedDate ? (
                      getBookingsForDate(selectedDate).length === 0 ? (
                        <div className="text-center py-12">
                          <div className="text-gray-400 mb-4">
                            <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                          <p className="text-gray-500 font-medium">No bookings for this date</p>
                          <p className="text-gray-400 text-sm mt-1">Select another date or check your schedule</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {getBookingsForDate(selectedDate).map((booking, index) => (
                            <div 
                              key={booking.id} 
                              className="border border-gray-200 rounded-xl p-6 hover:shadow-md transition-all duration-200 hover:border-blue-200 group"
                              style={{
                                animationDelay: `${index * 100}ms`,
                                animation: 'fadeInUp 0.5s ease-out forwards'
                              }}
                            >
                              <div className="flex items-center justify-between mb-4">
                                <div className="flex-1">
                                  <h4 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors duration-200">
                                    {booking.class.title}
                                  </h4>
                                  <p className="text-sm text-gray-500 mt-1">{booking.class.subject}</p>
                                </div>
                                <div className="flex items-center space-x-3">
                                  <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full transition-all duration-200 ${getStatusColor(booking.status)}`}>
                                    {booking.status}
                                  </span>
                                  {user?.userType === 'TUTOR' && (booking.status === 'CONFIRMED' || booking.status === 'COMPLETED') && (
                                    <div className="flex flex-col items-end space-y-2">
                                      <button
                                        onClick={() => startClass(booking.id)}
                                        disabled={updatingStatus === booking.id}
                                        className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-all duration-200 hover:scale-105 active:scale-95 shadow-md hover:shadow-lg"
                                      >
                                        {updatingStatus === booking.id ? (
                                          <div className="flex items-center">
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                            Starting...
                                          </div>
                                        ) : (
                                          booking.status === 'COMPLETED' ? 'Restart Class' : 'Start Class'
                                        )}
                                      </button>
                                      <span className={`text-xs px-3 py-1 rounded-full font-medium ${
                                        getSessionTimingStatus(booking).status === 'early' ? 'bg-yellow-100 text-yellow-700' :
                                        getSessionTimingStatus(booking).status === 'on-time' ? 'bg-green-100 text-green-700' :
                                        'bg-red-100 text-red-700'
                                      }`}>
                                        {getSessionTimingStatus(booking).message}
                                      </span>
                                    </div>
                                  )}
                                  {user?.userType === 'STUDENT' && (booking.status === 'CONFIRMED' || booking.status === 'COMPLETED') && (
                                    <div className="flex flex-col items-end space-y-2">
                                      <button
                                        onClick={() => joinClass(booking.id)}
                                        disabled={updatingStatus === booking.id}
                                        className="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-all duration-200 hover:scale-105 active:scale-95 shadow-md hover:shadow-lg"
                                      >
                                        {updatingStatus === booking.id ? (
                                          <div className="flex items-center">
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                            Joining...
                                          </div>
                                        ) : (
                                          booking.status === 'COMPLETED' ? 'Rejoin Class' : 'Join Class'
                                        )}
                                      </button>
                                      <span className={`text-xs px-3 py-1 rounded-full font-medium ${
                                        getSessionTimingStatus(booking).status === 'early' ? 'bg-yellow-100 text-yellow-700' :
                                        getSessionTimingStatus(booking).status === 'on-time' ? 'bg-green-100 text-green-700' :
                                        'bg-red-100 text-red-700'
                                      }`}>
                                        {getSessionTimingStatus(booking).message}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                              
                              <div className="grid grid-cols-2 gap-6 text-sm">
                                <div className="flex items-center space-x-2">
                                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                  </div>
                                  <div>
                                    <div className="text-gray-500 text-xs">Time</div>
                                    <div className="font-semibold text-gray-900">{formatTime(booking.scheduledAt)}</div>
                                  </div>
                                </div>
                                
                                <div className="flex items-center space-x-2">
                                  <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                                    <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                  </div>
                                  <div>
                                    <div className="text-gray-500 text-xs">Duration</div>
                                    <div className="font-semibold text-gray-900">{booking.class.durationMinutes} min</div>
                                  </div>
                                </div>
                                
                                <div className="flex items-center space-x-2">
                                  <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                                    <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                                    </svg>
                                  </div>
                                  <div>
                                    <div className="text-gray-500 text-xs">Price</div>
                                    <div className="font-semibold text-gray-900">${booking.class.pricePerSession}</div>
                                  </div>
                                </div>
                                
                                <div className="flex items-center space-x-2">
                                  <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                                    <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    </svg>
                                  </div>
                                  <div>
                                    <div className="text-gray-500 text-xs">
                                      {user?.userType === 'TUTOR' ? 'Student' : 'Tutor'}
                                    </div>
                                    <div className="font-semibold text-gray-900">
                                      {user?.userType === 'TUTOR' && booking.student 
                                        ? `${booking.student.firstName} ${booking.student.lastName}`
                                        : user?.userType === 'STUDENT' && booking.class.tutor
                                        ? `${booking.class.tutor.firstName} ${booking.class.tutor.lastName}`
                                        : 'N/A'
                                      }
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )
                    ) : (
                      <div className="text-center py-12">
                        <div className="text-gray-400 mb-4">
                          <svg className="mx-auto h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">Select a Date</h3>
                        <p className="text-gray-500">Click on any date in the calendar to view your bookings for that day.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
} 