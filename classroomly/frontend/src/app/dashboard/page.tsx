"use client";
import { useState, useEffect } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  userType: 'TUTOR' | 'STUDENT';
  bio?: string;
  subjects?: string;
  hourlyRate?: number;
}

const TutorAvailabilityManager = dynamic(() => import('@/components/tutor/TutorAvailabilityManager'), { ssr: false });

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [stats, setStats] = useState({
    classes: 0,
    bookings: 0,
    pendingBookings: 0,
    totalEarnings: 0,
    upcomingSessions: 0,
    completedSessions: 0
  });
  const [rescheduleRequests, setRescheduleRequests] = useState<any[]>([]);
  const [rescheduleLoading, setRescheduleLoading] = useState(false);
  const [rescheduleError, setRescheduleError] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [upcomingSessions, setUpcomingSessions] = useState<any[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsError, setSessionsError] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (token) {
      fetchUserProfile(token);
    } else {
      setLoading(false);
    }
  }, []);

  const fetchUserProfile = async (token: string) => {
    try {
      const response = await fetch('http://localhost:4000/api/profile', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const result = await response.json();
        const userData = result.data;
        
        const userInfo = {
          id: userData.id,
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          userType: userData.userType,
          bio: userData.bio || '',
          subjects: userData.subjects || '',
          hourlyRate: userData.hourlyRate || 0
        };
        
        setUser(userInfo);
        fetchDashboardStatsWithUser(userInfo);
      } else {
        localStorage.removeItem('authToken');
        window.location.href = '/auth';
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
      localStorage.removeItem('authToken');
      window.location.href = '/auth';
    } finally {
      setLoading(false);
    }
  };

  // Set up automatic polling for stats every 30 seconds
  useEffect(() => {
    if (!user) return;
    
    fetchDashboardStats();
    
    const interval = setInterval(() => {
      fetchDashboardStats();
    }, 30000);

    return () => clearInterval(interval);
  }, [user]);

  // Listen for booking and class changes to trigger immediate stats refresh
  useEffect(() => {
    const handleDataChange = () => {
      fetchDashboardStats();
    };

    window.addEventListener('bookingCreated', handleDataChange);
    window.addEventListener('bookingUpdated', handleDataChange);
    window.addEventListener('bookingDeleted', handleDataChange);
    window.addEventListener('bookingStatusChanged', handleDataChange);
    window.addEventListener('classCreated', handleDataChange);
    window.addEventListener('classUpdated', handleDataChange);
    window.addEventListener('classDeleted', handleDataChange);

    return () => {
      window.removeEventListener('bookingCreated', handleDataChange);
      window.removeEventListener('bookingUpdated', handleDataChange);
      window.removeEventListener('bookingDeleted', handleDataChange);
      window.removeEventListener('bookingStatusChanged', handleDataChange);
      window.removeEventListener('classCreated', handleDataChange);
      window.removeEventListener('classUpdated', handleDataChange);
      window.removeEventListener('classDeleted', handleDataChange);
    };
  }, []);

  const fetchDashboardStats = async () => {
    if (!user) return;
    await fetchDashboardStatsWithUser(user);
  };

  const fetchDashboardStatsWithUser = async (userData: User) => {
    setStatsLoading(true);
    try {
      const token = localStorage.getItem('authToken');
      
      if (!token) {
        localStorage.removeItem('authToken');
        window.location.href = '/auth';
        return;
      }
      
      const classesResponse = await fetch(`http://localhost:4000/api/classes?tutorId=${userData.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const bookingsResponse = await fetch('http://localhost:4000/api/bookings', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (classesResponse.status === 401 || bookingsResponse.status === 401) {
        localStorage.removeItem('authToken');
        window.location.href = '/auth';
        return;
      }

      if (classesResponse.ok && bookingsResponse.ok) {
        const classesData = await classesResponse.json();
        const bookingsData = await bookingsResponse.json();
        
        const classes = classesData.data || [];
        const bookings = bookingsData.data || [];
        
        const userType = userData?.userType;
        
        if (userType === 'TUTOR') {
          const myClasses = classes;
          const myBookings = bookings.filter((booking: any) => booking.class.tutor?.id === userData?.id);
          const pendingBookings = myBookings.filter((booking: any) => booking.status === 'PENDING');
          const upcomingSessions = myBookings.filter((booking: any) => 
            booking.status === 'CONFIRMED' && new Date(booking.scheduledAt) > new Date()
          );
          const completedSessions = myBookings.filter((booking: any) => booking.status === 'COMPLETED');
          
          const totalEarnings = completedSessions.reduce((sum: number, booking: any) => 
            sum + booking.class.pricePerSession, 0
          );
          
          setStats({
            classes: myClasses.length,
            bookings: myBookings.length,
            pendingBookings: pendingBookings.length,
            totalEarnings,
            upcomingSessions: upcomingSessions.length,
            completedSessions: completedSessions.length
          });
        } else {
          const myBookings = bookings.filter((booking: any) => booking.student?.id === userData?.id);
          const pendingBookings = myBookings.filter((booking: any) => booking.status === 'PENDING');
          const upcomingSessions = myBookings.filter((booking: any) => 
            booking.status === 'CONFIRMED' && new Date(booking.scheduledAt) > new Date()
          );
          const completedSessions = myBookings.filter((booking: any) => booking.status === 'COMPLETED');
          
          setStats({
            classes: 0,
            bookings: myBookings.length,
            pendingBookings: pendingBookings.length,
            totalEarnings: 0,
            upcomingSessions: upcomingSessions.length,
            completedSessions: completedSessions.length
          });
        }
      }
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setStatsLoading(false);
      setLastUpdated(new Date());
    }
  };

  // Fetch reschedule requests for the user
  useEffect(() => {
    const fetchRescheduleRequests = async () => {
      setRescheduleLoading(true);
      setRescheduleError(null);
      const token = localStorage.getItem('authToken');
      
      if (!token) {
        setRescheduleLoading(false);
        return;
      }
      
      try {
        const response = await fetch('http://localhost:4000/api/bookings/reschedule-requests', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
          const data = await response.json();
          setRescheduleRequests(data.data || []);
        } else {
          setRescheduleError('Failed to fetch reschedule requests');
        }
      } catch (error) {
        console.error('Error fetching reschedule requests:', error);
        setRescheduleError('Failed to fetch reschedule requests');
      } finally {
        setRescheduleLoading(false);
      }
    };

    if (user) {
      fetchRescheduleRequests();
    }
  }, [user]);

  const handleAccept = async (request: any) => {
    setActionLoadingId(request.id);
    setActionError(null);
    const token = localStorage.getItem('authToken');
    
    try {
      const response = await fetch(`http://localhost:4000/api/bookings/${request.bookingId}/reschedule/accept`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const result = await response.json();
      if (response.ok) {
        // Refresh reschedule requests
        window.location.reload();
      } else {
        setActionError(result.message || 'Failed to accept reschedule');
      }
    } catch (error) {
      console.error('Error accepting reschedule:', error);
      setActionError('Failed to accept reschedule');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDecline = async (request: any) => {
    setActionLoadingId(request.id);
    setActionError(null);
    const token = localStorage.getItem('authToken');
    
    try {
      const response = await fetch(`http://localhost:4000/api/bookings/${request.bookingId}/reschedule/decline`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const result = await response.json();
      if (response.ok) {
        // Refresh reschedule requests
        window.location.reload();
      } else {
        setActionError(result.message || 'Failed to decline reschedule');
      }
    } catch (error) {
      console.error('Error declining reschedule:', error);
      setActionError('Failed to decline reschedule');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Fetch upcoming sessions
  useEffect(() => {
    const fetchUpcomingSessions = async () => {
      setSessionsLoading(true);
      setSessionsError(null);
      const token = localStorage.getItem('authToken');
      
      if (!token) {
        setSessionsLoading(false);
        return;
      }
      
      try {
        const response = await fetch('http://localhost:4000/api/sessions', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
          const data = await response.json();
          setUpcomingSessions(data.data || []);
        } else {
          setSessionsError('Failed to fetch upcoming sessions');
        }
      } catch (error) {
        console.error('Error fetching upcoming sessions:', error);
        setSessionsError('Failed to fetch upcoming sessions');
      } finally {
        setSessionsLoading(false);
      }
    };

    if (user) {
      fetchUpcomingSessions();
    }
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
          <p className="text-gray-600 mb-4">Please log in to access your dashboard.</p>
          <Link href="/auth" className="btn btn-primary">
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome back, {user.firstName}!
          </h1>
          <p className="text-gray-600">
            Here's what's happening with your {user.userType === 'TUTOR' ? 'tutoring' : 'learning'} today.
          </p>
          {lastUpdated && (
            <p className="text-sm text-gray-500 mt-2">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </p>
          )}
        </div>

        {/* Dashboard Content */}
        <div className="space-y-8">
          {/* Stats Cards */}
          {user.userType === 'TUTOR' ? (
            <TutorDashboard user={user} stats={stats} statsLoading={statsLoading} />
          ) : (
            <StudentDashboard user={user} stats={stats} statsLoading={statsLoading} />
          )}

          {/* Reschedule Requests */}
          {rescheduleRequests.length > 0 && (
            <div className="card">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Reschedule Requests</h2>
              </div>
              <div className="p-6">
                {rescheduleLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-2 text-gray-600">Loading requests...</p>
                  </div>
                ) : rescheduleError ? (
                  <div className="text-red-600 text-center py-4">{rescheduleError}</div>
                ) : (
                  <div className="space-y-4">
                    {rescheduleRequests.map((request) => (
                      <div key={request.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div>
                          <p className="font-medium text-gray-900">
                            {request.class.title} - {new Date(request.proposedTime).toLocaleString()}
                          </p>
                          <p className="text-sm text-gray-600">
                            Requested by: {request.requestedBy.firstName} {request.requestedBy.lastName}
                          </p>
                        </div>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleAccept(request)}
                            disabled={actionLoadingId === request.id}
                            className="btn btn-success text-sm"
                          >
                            {actionLoadingId === request.id ? 'Accepting...' : 'Accept'}
                          </button>
                          <button
                            onClick={() => handleDecline(request)}
                            disabled={actionLoadingId === request.id}
                            className="btn btn-danger text-sm"
                          >
                            {actionLoadingId === request.id ? 'Declining...' : 'Decline'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {actionError && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
                    <p className="text-red-800 text-sm">{actionError}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Upcoming Sessions */}
          <div className="card">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Upcoming Sessions</h2>
            </div>
            <div className="p-6">
              {sessionsLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-2 text-gray-600">Loading sessions...</p>
                </div>
              ) : sessionsError ? (
                <div className="text-red-600 text-center py-4">{sessionsError}</div>
              ) : upcomingSessions.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <p className="text-gray-600">No upcoming sessions</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {upcomingSessions.map((session) => {
                    const start = new Date(session.startTime);
                    const end = new Date(session.endTime);
                    const now = new Date();
                    const canJoin = (start.getTime() - now.getTime()) / 60000 <= 10 || session.status === 'IN_PROGRESS';
                    const otherParty = user.userType === 'TUTOR'
                      ? `${session.student.firstName} ${session.student.lastName}`
                      : `${session.tutor.firstName} ${session.tutor.lastName}`;
                    
                    return (
                      <div key={session.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900">{session.class.title}</h3>
                          <p className="text-sm text-gray-600">
                            {start.toLocaleDateString()} at {start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                          <p className="text-sm text-gray-500">
                            {user.userType === 'TUTOR' ? 'Student' : 'Tutor'}: {otherParty}
                          </p>
                          <span className={`badge ${session.status === 'CONFIRMED' ? 'badge-success' : 'badge-warning'}`}>
                            {session.status}
                          </span>
                        </div>
                        {canJoin && (
                          <Link
                            href={`/session/${session.id}`}
                            className="btn btn-primary"
                          >
                            Join Session
                          </Link>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TutorDashboard({ user, stats, statsLoading }: { user: User; stats: any; statsLoading: boolean; }) {
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    setToken(localStorage.getItem('authToken'));
  }, []);

  return (
    <div className="space-y-8">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="card card-hover">
          <div className="p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
              </div>
              <div className="ml-4 flex-1">
                <p className="text-sm font-medium text-gray-500">Active Classes</p>
                <p className="text-2xl font-bold text-gray-900">
                  {statsLoading ? (
                    <div className="skeleton-text w-8"></div>
                  ) : (
                    stats.classes
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="card card-hover">
          <div className="p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>
              <div className="ml-4 flex-1">
                <p className="text-sm font-medium text-gray-500">Total Bookings</p>
                <p className="text-2xl font-bold text-gray-900">
                  {statsLoading ? (
                    <div className="skeleton-text w-8"></div>
                  ) : (
                    stats.bookings
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="card card-hover">
          <div className="p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-yellow-500 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <div className="ml-4 flex-1">
                <p className="text-sm font-medium text-gray-500">Pending Bookings</p>
                <p className="text-2xl font-bold text-gray-900">
                  {statsLoading ? (
                    <div className="skeleton-text w-8"></div>
                  ) : (
                    stats.pendingBookings
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="card card-hover">
          <div className="p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-purple-500 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                  </svg>
                </div>
              </div>
              <div className="ml-4 flex-1">
                <p className="text-sm font-medium text-gray-500">Total Earnings</p>
                <p className="text-2xl font-bold text-gray-900">
                  {statsLoading ? (
                    <div className="skeleton-text w-16"></div>
                  ) : (
                    `$${stats.totalEarnings}`
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="card card-hover">
          <div className="p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-indigo-500 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>
              <div className="ml-4 flex-1">
                <p className="text-sm font-medium text-gray-500">Upcoming Sessions</p>
                <p className="text-2xl font-bold text-gray-900">
                  {statsLoading ? (
                    <div className="skeleton-text w-8"></div>
                  ) : (
                    stats.upcomingSessions
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="card card-hover">
          <div className="p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <div className="ml-4 flex-1">
                <p className="text-sm font-medium text-gray-500">Completed Sessions</p>
                <p className="text-2xl font-bold text-gray-900">
                  {statsLoading ? (
                    <div className="skeleton-text w-8"></div>
                  ) : (
                    stats.completedSessions
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Quick Actions</h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Link 
              href="/classes/create" 
              className="card card-hover p-6 group"
            >
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  </div>
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-medium text-gray-900">Create New Class</h3>
                  <p className="text-sm text-gray-500">Start a new tutoring class</p>
                </div>
              </div>
            </Link>

            <Link 
              href="/classes" 
              className="card card-hover p-6 group"
            >
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center group-hover:bg-green-200 transition-colors">
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                  </div>
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-medium text-gray-900">Manage Classes</h3>
                  <p className="text-sm text-gray-500">View and manage your classes</p>
                </div>
              </div>
            </Link>

            <Link 
              href="/bookings" 
              className="card card-hover p-6 group"
            >
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center group-hover:bg-purple-200 transition-colors">
                    <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-medium text-gray-900">View Bookings</h3>
                  <p className="text-sm text-gray-500">See upcoming sessions</p>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </div>

      {/* Availability Manager */}
      {token && (
        <div className="card">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Manage Availability</h2>
          </div>
          <div className="p-6">
            <TutorAvailabilityManager 
              tutorId={user.id} 
              onAvailabilityChange={() => {
                window.dispatchEvent(new CustomEvent('availabilityChanged'));
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function StudentDashboard({ user, stats, statsLoading }: { user: User; stats: any; statsLoading: boolean; }) {
  return (
    <div className="space-y-8">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="card card-hover">
          <div className="p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>
              <div className="ml-4 flex-1">
                <p className="text-sm font-medium text-gray-500">Total Bookings</p>
                <p className="text-2xl font-bold text-gray-900">
                  {statsLoading ? (
                    <div className="skeleton-text w-8"></div>
                  ) : (
                    stats.bookings
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="card card-hover">
          <div className="p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>
              <div className="ml-4 flex-1">
                <p className="text-sm font-medium text-gray-500">Upcoming Sessions</p>
                <p className="text-2xl font-bold text-gray-900">
                  {statsLoading ? (
                    <div className="skeleton-text w-8"></div>
                  ) : (
                    stats.upcomingSessions
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="card card-hover">
          <div className="p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-yellow-500 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <div className="ml-4 flex-1">
                <p className="text-sm font-medium text-gray-500">Pending Bookings</p>
                <p className="text-2xl font-bold text-gray-900">
                  {statsLoading ? (
                    <div className="skeleton-text w-8"></div>
                  ) : (
                    stats.pendingBookings
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="card card-hover">
          <div className="p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <div className="ml-4 flex-1">
                <p className="text-sm font-medium text-gray-500">Completed Sessions</p>
                <p className="text-2xl font-bold text-gray-900">
                  {statsLoading ? (
                    <div className="skeleton-text w-8"></div>
                  ) : (
                    stats.completedSessions
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Quick Actions</h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Link 
              href="/classes" 
              className="card card-hover p-6 group"
            >
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-medium text-gray-900">Find Classes</h3>
                  <p className="text-sm text-gray-500">Discover great tutoring classes</p>
                </div>
              </div>
            </Link>

            <Link 
              href="/bookings" 
              className="card card-hover p-6 group"
            >
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center group-hover:bg-green-200 transition-colors">
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-medium text-gray-900">My Bookings</h3>
                  <p className="text-sm text-gray-500">View your sessions</p>
                </div>
              </div>
            </Link>

            <Link 
              href="/profile" 
              className="card card-hover p-6 group"
            >
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center group-hover:bg-purple-200 transition-colors">
                    <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-medium text-gray-900">Update Profile</h3>
                  <p className="text-sm text-gray-500">Manage your preferences</p>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
} 