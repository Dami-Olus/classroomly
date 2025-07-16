"use client";
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface BookingLink {
  id: string;
  token: string;
  expiresAt: string;
  isActive: boolean;
  class: {
    id: string;
    title: string;
    description?: string;
    subject: string;
    level?: string;
    maxStudents: number;
    durationMinutes: number;
    pricePerSession: number;
    isActive: boolean;
    tutor: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      bio?: string;
      subjects?: string;
      hourlyRate?: number;
    };
  };
}

export default function PublicBookingPage() {
  const params = useParams();
  const token = params.token as string;
  
  const [bookingLink, setBookingLink] = useState<BookingLink | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingError, setBookingError] = useState('');
  const [bookingSuccess, setBookingSuccess] = useState('');
  const [formData, setFormData] = useState({
    studentName: '',
    studentEmail: '',
    scheduledAt: '',
    notes: ''
  });

  useEffect(() => {
    fetchBookingLink();
  }, [token]);

  const fetchBookingLink = async () => {
    try {
      const response = await fetch(`http://localhost:4000/api/bookings/link/${token}`);
      const result = await response.json();

      if (response.ok) {
        setBookingLink(result.data);
      } else {
        setError(result.message || 'Failed to fetch booking link');
      }
    } catch (err) {
      setError('An error occurred while fetching the booking link');
    } finally {
      setLoading(false);
    }
  };

  const handleBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    setBookingLoading(true);
    setBookingError('');
    setBookingSuccess('');

    try {
      const response = await fetch(`http://localhost:4000/api/bookings/link/${token}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      const result = await response.json();

      if (response.ok) {
        setBookingSuccess('Booking created successfully! You will receive a confirmation email shortly.');
        setFormData({
          studentName: '',
          studentEmail: '',
          scheduledAt: '',
          notes: ''
        });
        
        // Dispatch custom event to notify dashboard of booking creation
        if (bookingLink) {
          window.dispatchEvent(new CustomEvent('bookingCreated', {
            detail: { 
              classId: bookingLink.class.id, 
              tutorId: bookingLink.class.tutor.id 
            }
          }));
        }
      } else {
        setBookingError(result.message || 'Failed to create booking');
      }
    } catch (err) {
      setBookingError('An error occurred while creating the booking');
    } finally {
      setBookingLoading(false);
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
          <h2 className="text-2xl font-bold mb-4">Booking Link Error</h2>
          <p className="text-red-600 mb-4">{error}</p>
          <Link 
            href="/" 
            className="inline-block bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
          >
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  if (!bookingLink) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Booking link not found</h2>
          <Link 
            href="/" 
            className="inline-block bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
          >
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  const subjectsArray = bookingLink.class.tutor.subjects ? bookingLink.class.tutor.subjects.split(',').map(s => s.trim()) : [];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <Link href="/" className="text-blue-600 hover:text-blue-500 mr-4">
                ← Back to Home
              </Link>
              <h1 className="text-2xl font-bold text-gray-900">Book Your Session</h1>
            </div>
            <div className="text-sm text-gray-500">
              Expires: {new Date(bookingLink.expiresAt).toLocaleDateString()}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Class Details */}
            <div className="lg:col-span-2">
              <div className="bg-white shadow rounded-lg">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h2 className="text-xl font-semibold text-gray-900">Class Information</h2>
                </div>
                <div className="px-6 py-4">
                  <h3 className="text-2xl font-bold text-gray-900 mb-4">{bookingLink.class.title}</h3>
                  
                  {bookingLink.class.description && (
                    <div className="mb-6">
                      <h4 className="text-lg font-medium text-gray-900 mb-2">Description</h4>
                      <p className="text-gray-600">{bookingLink.class.description}</p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <h4 className="text-lg font-medium text-gray-900 mb-2">Class Details</h4>
                      <dl className="space-y-2">
                        <div className="flex justify-between">
                          <dt className="text-gray-500">Subject:</dt>
                          <dd className="font-medium">{bookingLink.class.subject}</dd>
                        </div>
                        {bookingLink.class.level && (
                          <div className="flex justify-between">
                            <dt className="text-gray-500">Level:</dt>
                            <dd className="font-medium capitalize">{bookingLink.class.level}</dd>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <dt className="text-gray-500">Duration:</dt>
                          <dd className="font-medium">{bookingLink.class.durationMinutes} minutes</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-gray-500">Max Students:</dt>
                          <dd className="font-medium">{bookingLink.class.maxStudents}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-gray-500">Price per Session:</dt>
                          <dd className="font-medium">${bookingLink.class.pricePerSession}</dd>
                        </div>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tutor Information */}
              <div className="mt-6 bg-white shadow rounded-lg">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h2 className="text-xl font-semibold text-gray-900">About Your Tutor</h2>
                </div>
                <div className="px-6 py-4">
                  <div className="flex items-center mb-4">
                    <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-white font-semibold">
                      {bookingLink.class.tutor.firstName[0]}{bookingLink.class.tutor.lastName[0]}
                    </div>
                    <div className="ml-4">
                      <h3 className="text-lg font-medium text-gray-900">
                        {bookingLink.class.tutor.firstName} {bookingLink.class.tutor.lastName}
                      </h3>
                      <p className="text-gray-500">{bookingLink.class.tutor.email}</p>
                    </div>
                  </div>

                  {bookingLink.class.tutor.bio && (
                    <div className="mb-4">
                      <h4 className="text-sm font-medium text-gray-900 mb-1">Bio</h4>
                      <p className="text-gray-600 text-sm">{bookingLink.class.tutor.bio}</p>
                    </div>
                  )}

                  {bookingLink.class.tutor.hourlyRate && (
                    <div className="mb-4">
                      <h4 className="text-sm font-medium text-gray-900 mb-1">Hourly Rate</h4>
                      <p className="text-gray-600 text-sm">${bookingLink.class.tutor.hourlyRate}/hour</p>
                    </div>
                  )}

                  {subjectsArray.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-900 mb-1">Subjects</h4>
                      <div className="flex flex-wrap gap-2">
                        {subjectsArray.map((subject, index) => (
                          <span 
                            key={index}
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                          >
                            {subject}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Booking Form */}
            <div className="lg:col-span-1">
              <div className="bg-white shadow rounded-lg sticky top-6">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h2 className="text-xl font-semibold text-gray-900">Book Your Session</h2>
                </div>
                <div className="px-6 py-4">
                  {bookingSuccess ? (
                    <div className="text-center py-4">
                      <div className="text-green-600 mb-4">
                        <svg className="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <p className="text-green-600 font-medium">{bookingSuccess}</p>
                    </div>
                  ) : (
                    <form onSubmit={handleBooking} className="space-y-4">
                      {bookingError && (
                        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
                          {bookingError}
                        </div>
                      )}

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Your Name *
                        </label>
                        <input
                          type="text"
                          value={formData.studentName}
                          onChange={(e) => setFormData({ ...formData, studentName: e.target.value })}
                          className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                          required
                          placeholder="Enter your full name"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Email Address *
                        </label>
                        <input
                          type="email"
                          value={formData.studentEmail}
                          onChange={(e) => setFormData({ ...formData, studentEmail: e.target.value })}
                          className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                          required
                          placeholder="Enter your email"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Preferred Date & Time *
                        </label>
                        <input
                          type="datetime-local"
                          value={formData.scheduledAt}
                          onChange={(e) => setFormData({ ...formData, scheduledAt: e.target.value })}
                          className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                          required
                          min={new Date().toISOString().slice(0, 16)}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Notes (Optional)
                        </label>
                        <textarea
                          value={formData.notes}
                          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                          rows={3}
                          className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                          placeholder="Any specific topics you'd like to cover..."
                        />
                      </div>

                      <div className="bg-gray-50 p-3 rounded-lg">
                        <div className="flex justify-between text-sm mb-2">
                          <span className="text-gray-500">Session Price:</span>
                          <span className="font-medium">${bookingLink.class.pricePerSession}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Duration:</span>
                          <span className="font-medium">{bookingLink.class.durationMinutes} minutes</span>
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={bookingLoading}
                        className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
                      >
                        {bookingLoading ? 'Booking...' : 'Confirm Booking'}
                      </button>
                    </form>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
} 