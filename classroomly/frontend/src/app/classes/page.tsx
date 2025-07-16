"use client";
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

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
  };
}

interface User {
  id: string;
  userType: 'TUTOR' | 'STUDENT';
}

export default function ClassesPage() {
  const [classes, setClasses] = useState<Class[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    subject: '',
    level: '',
    tutorId: ''
  });

  console.log('ClassesPage render - user:', user, 'filters:', filters);

  useEffect(() => {
    // Get user info from token
    const token = localStorage.getItem('authToken');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const userData = {
          id: payload.id,
          userType: payload.userType
        };
        setUser(userData);
        
        // For tutors, automatically filter to show only their classes
        if (userData.userType === 'TUTOR') {
          setFilters(prev => ({ ...prev, tutorId: userData.id }));
        }
      } catch (error) {
        console.error('Error parsing token:', error);
      }
    }
  }, []); // Only run once on mount

  // Ensure tutorId filter is always set for tutors
  useEffect(() => {
    if (user?.userType === 'TUTOR' && user.id) {
      console.log('Setting tutorId filter for tutor:', user.id);
      setFilters(prev => ({ ...prev, tutorId: user.id }));
    }
  }, [user]);

  const fetchClasses = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filters.subject) params.append('subject', filters.subject);
      if (filters.level) params.append('level', filters.level);
      
      // For tutors, always enforce the tutorId filter
      if (user?.userType === 'TUTOR') {
        params.append('tutorId', user.id);
        console.log('Tutor fetching classes with tutorId:', user.id);
      } else if (filters.tutorId) {
        params.append('tutorId', filters.tutorId);
      }

      const response = await fetch(`http://localhost:4000/api/classes?${params}`);
      const result = await response.json();

      if (response.ok) {
        let classesData = result.data || [];
        
        // Double-check: for tutors, filter out any classes that don't belong to them
        if (user?.userType === 'TUTOR') {
          classesData = classesData.filter((cls: Class) => cls.tutor.id === user.id);
          console.log('Filtered classes for tutor:', classesData.length, 'classes');
        }
        
        setClasses(classesData);
      } else {
        setError(result.message || 'Failed to fetch classes');
      }
    } catch {
      setError('An error occurred while fetching classes');
    } finally {
      setLoading(false);
    }
  }, [filters, user]); // Add user as dependency

  useEffect(() => {
    fetchClasses();
  }, [fetchClasses]); // Only depend on fetchClasses for fetching classes

  const handleDeleteClass = async (classId: string) => {
    if (!confirm('Are you sure you want to delete this class?')) return;

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`http://localhost:4000/api/classes/${classId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        setClasses(classes.filter(c => c.id !== classId));
      } else {
        const result = await response.json();
        alert(result.message || 'Failed to delete class');
      }
    } catch {
      alert('An error occurred while deleting the class');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
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
                {user?.userType === 'TUTOR' ? 'My Classes' : 'Browse Classes'}
              </h1>
            </div>
            {user?.userType === 'TUTOR' && (
              <Link
                href="/classes/create"
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
              >
                Create New Class
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Filters */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="bg-white shadow rounded-lg p-4">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Filters</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Subject</label>
              <input
                type="text"
                value={filters.subject}
                onChange={(e) => setFilters({ ...filters, subject: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="Filter by subject..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Level</label>
              <select
                value={filters.level}
                onChange={(e) => setFilters({ ...filters, level: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All levels</option>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {classes.length === 0 ? (
            <div className="text-center py-12">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No classes found</h3>
              <p className="mt-1 text-sm text-gray-500">
                {user?.userType === 'TUTOR' 
                  ? 'Get started by creating your first class.'
                  : 'No classes match your current filters.'
                }
              </p>
              {user?.userType === 'TUTOR' && (
                <div className="mt-6">
                  <Link
                    href="/classes/create"
                    className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                  >
                    Create Class
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {classes.map((cls) => (
                <div key={cls.id} className="bg-white overflow-hidden shadow rounded-lg">
                  <div className="p-6">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-medium text-gray-900 truncate">{cls.title}</h3>
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        cls.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {cls.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    
                    {cls.description && (
                      <p className="mt-2 text-sm text-gray-600 line-clamp-2">{cls.description}</p>
                    )}
                    
                    <div className="mt-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Subject:</span>
                        <span className="font-medium">{cls.subject}</span>
                      </div>
                      
                      {cls.level && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Level:</span>
                          <span className="font-medium capitalize">{cls.level}</span>
                        </div>
                      )}
                      
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Duration:</span>
                        <span className="font-medium">{cls.durationMinutes} min</span>
                      </div>
                      
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Max Students:</span>
                        <span className="font-medium">{cls.maxStudents}</span>
                      </div>
                      
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Price:</span>
                        <span className="font-medium">${cls.pricePerSession}</span>
                      </div>
                      
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Tutor:</span>
                        <span className="font-medium">{cls.tutor.firstName} {cls.tutor.lastName}</span>
                      </div>
                    </div>
                    
                    <div className="mt-6 flex justify-between">
                      {user?.userType === 'STUDENT' ? (
                        <Link
                          href={`/classes/${cls.id}`}
                          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm"
                        >
                          View Details
                        </Link>
                      ) : (
                        <div className="flex space-x-2">
                          <Link
                            href={`/classes/${cls.id}`}
                            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm"
                          >
                            View
                          </Link>
                          <Link
                            href={`/classes/${cls.id}/edit`}
                            className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 text-sm"
                          >
                            Edit
                          </Link>
                          <button
                            onClick={() => handleDeleteClass(cls.id)}
                            className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 text-sm"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
} 