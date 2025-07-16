"use client";
import Link from 'next/link';

export default function Navigation() {
  const handleSignOut = () => {
    localStorage.removeItem('authToken');
    window.location.href = '/auth';
  };

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo/Brand */}
          <div className="flex items-center">
            <Link href="/dashboard" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">C</span>
              </div>
              <span className="text-xl font-bold text-gray-900">Classroomly</span>
            </Link>
          </div>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center space-x-8">
            <Link 
              href="/dashboard" 
              className="text-gray-600 hover:text-blue-600 font-medium transition-colors duration-200 px-3 py-2 rounded-md text-sm"
            >
              Dashboard
            </Link>
            <Link 
              href="/classes" 
              className="text-gray-600 hover:text-blue-600 font-medium transition-colors duration-200 px-3 py-2 rounded-md text-sm"
            >
              Classes
            </Link>
            <Link 
              href="/bookings" 
              className="text-gray-600 hover:text-blue-600 font-medium transition-colors duration-200 px-3 py-2 rounded-md text-sm"
            >
              Bookings
            </Link>
            <Link 
              href="/profile" 
              className="text-gray-600 hover:text-blue-600 font-medium transition-colors duration-200 px-3 py-2 rounded-md text-sm"
            >
              Profile
            </Link>
            <Link 
              href="/help" 
              className="text-gray-600 hover:text-blue-600 font-medium transition-colors duration-200 px-3 py-2 rounded-md text-sm"
            >
              Help
            </Link>
          </div>

          {/* Right side - Sign Out */}
          <div className="flex items-center space-x-4">
            <button
              onClick={handleSignOut}
              className="hidden md:flex items-center space-x-2 text-gray-600 hover:text-red-600 font-medium transition-colors duration-200 px-3 py-2 rounded-md text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span>Sign Out</span>
            </button>

            {/* Mobile menu button */}
            <div className="md:hidden">
              <button className="text-gray-600 hover:text-gray-900 p-2">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
} 