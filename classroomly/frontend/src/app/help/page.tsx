import React from 'react';

export default function HelpPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Help & Onboarding</h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Get started with Classroomly and make the most of your learning or teaching experience
          </p>
        </div>

        <div className="space-y-12">
          {/* Welcome Section */}
          <div className="card">
            <div className="p-8">
              <div className="flex items-center mb-6">
                <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center mr-4">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-900">Welcome to Classroomly!</h2>
              </div>
              <p className="text-gray-600 text-lg leading-relaxed">
                This comprehensive guide will help you navigate the platform, whether you're a tutor looking to share your expertise or a student seeking personalized learning experiences.
              </p>
            </div>
          </div>

          {/* For Tutors Section */}
          <div className="card">
            <div className="px-8 py-6 border-b border-gray-200">
              <div className="flex items-center">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-900">For Tutors</h2>
              </div>
            </div>
            <div className="p-8 space-y-8">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                  <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold mr-3">1</span>
                  Create a New Class
                </h3>
                <ol className="list-decimal list-inside space-y-2 text-gray-600 ml-9">
                  <li>Log in to your Classroomly account</li>
                  <li>On the dashboard, click <strong className="text-gray-900">Create New Class</strong> under Quick Actions</li>
                  <li>Fill in the class details (title, subject, description, price, etc.)</li>
                  <li>Submit the form to publish your class and make it available for students to book</li>
                </ol>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                  <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold mr-3">2</span>
                  Set Your Availability
                </h3>
                <ol className="list-decimal list-inside space-y-2 text-gray-600 ml-9">
                  <li>In the dashboard, find the <strong className="text-gray-900">Availability</strong> section</li>
                  <li>Add your available time slots so students can book sessions with you</li>
                  <li>Save your changes</li>
                </ol>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                  <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold mr-3">3</span>
                  Manage Bookings and Sessions
                </h3>
                <ol className="list-decimal list-inside space-y-2 text-gray-600 ml-9">
                  <li>View your upcoming sessions in the <strong className="text-gray-900">Upcoming Sessions</strong> section</li>
                  <li>Click <strong className="text-gray-900">Join</strong> when it's time for your session</li>
                  <li>Manage reschedule requests from students in the <strong className="text-gray-900">Reschedule Requests</strong> section
                    <ul className="list-disc list-inside ml-4 mt-1">
                      <li>Accept or decline requests as needed</li>
                    </ul>
                  </li>
                </ol>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                  <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold mr-3">4</span>
                  Update Your Profile
                </h3>
                <ol className="list-decimal list-inside space-y-2 text-gray-600 ml-9">
                  <li>Click <strong className="text-gray-900">Update Profile</strong> in the Quick Actions or navigation menu</li>
                  <li>Edit your bio, subjects, hourly rate, and other details</li>
                  <li>Save your changes</li>
                </ol>
              </div>
            </div>
          </div>

          {/* For Students Section */}
          <div className="card">
            <div className="px-8 py-6 border-b border-gray-200">
              <div className="flex items-center">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mr-3">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-900">For Students</h2>
              </div>
            </div>
            <div className="p-8 space-y-8">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                  <span className="w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-bold mr-3">1</span>
                  Find and Book a Class
                </h3>
                <ol className="list-decimal list-inside space-y-2 text-gray-600 ml-9">
                  <li>Log in to your Classroomly account</li>
                  <li>Click <strong className="text-gray-900">Find Classes</strong> in the Quick Actions or navigation menu</li>
                  <li>Browse available classes and select one that interests you</li>
                  <li>Book a session by choosing a time slot and confirming your booking</li>
                </ol>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                  <span className="w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-bold mr-3">2</span>
                  View and Join Upcoming Sessions
                </h3>
                <ol className="list-decimal list-inside space-y-2 text-gray-600 ml-9">
                  <li>Your upcoming sessions are listed in the <strong className="text-gray-900">Upcoming Sessions</strong> section of the dashboard</li>
                  <li>At the scheduled time, click <strong className="text-gray-900">Join</strong> to enter your session</li>
                </ol>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                  <span className="w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-bold mr-3">3</span>
                  Manage Reschedule Requests
                </h3>
                <ol className="list-decimal list-inside space-y-2 text-gray-600 ml-9">
                  <li>If you need to reschedule, use the reschedule option in your session details</li>
                  <li>Track the status of your requests in the dashboard</li>
                </ol>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                  <span className="w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-bold mr-3">4</span>
                  Update Your Profile
                </h3>
                <ol className="list-decimal list-inside space-y-2 text-gray-600 ml-9">
                  <li>Click <strong className="text-gray-900">Update Profile</strong> in the Quick Actions or navigation menu</li>
                  <li>Edit your personal information and preferences</li>
                  <li>Save your changes</li>
                </ol>
              </div>
            </div>
          </div>

          {/* Tips Section */}
          <div className="card">
            <div className="px-8 py-6 border-b border-gray-200">
              <div className="flex items-center">
                <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center mr-3">
                  <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-900">Pro Tips</h2>
              </div>
            </div>
            <div className="p-8">
              <ul className="space-y-3 text-gray-600">
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-blue-600 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  Always check your upcoming sessions so you don't miss a class
                </li>
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-blue-600 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  <strong className="text-gray-900">Tutors:</strong> Keep your availability up to date for more bookings
                </li>
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-blue-600 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  <strong className="text-gray-900">Students:</strong> Book early to secure your preferred time slots
                </li>
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-blue-600 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  Use the support resources if you have any questions or run into issues
                </li>
              </ul>
            </div>
          </div>

          {/* FAQs Section */}
          <div className="card">
            <div className="px-8 py-6 border-b border-gray-200">
              <div className="flex items-center">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center mr-3">
                  <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-900">Frequently Asked Questions</h2>
              </div>
            </div>
            <div className="p-8">
              <div className="space-y-8">
                <div className="border-b border-gray-100 pb-6 last:border-b-0">
                  <h4 className="text-lg font-semibold text-gray-900 mb-3">How do I reset my password?</h4>
                  <p className="text-gray-600">Go to the <strong className="text-gray-900">Forgot Password</strong> page from the login screen, enter your email, and follow the instructions sent to your inbox.</p>
                </div>

                <div className="border-b border-gray-100 pb-6 last:border-b-0">
                  <h4 className="text-lg font-semibold text-gray-900 mb-3">What if I miss a session?</h4>
                  <p className="text-gray-600">If you miss a session, contact your tutor or student to reschedule. Tutors may set their own policies for missed sessions.</p>
                </div>

                <div className="border-b border-gray-100 pb-6 last:border-b-0">
                  <h4 className="text-lg font-semibold text-gray-900 mb-3">How do I contact support?</h4>
                  <p className="text-gray-600">Click the <strong className="text-gray-900">Help</strong> link in the navigation bar and use the contact form or email provided on this page. You can also check the FAQs for quick answers.</p>
                </div>

                <div className="border-b border-gray-100 pb-6 last:border-b-0">
                  <h4 className="text-lg font-semibold text-gray-900 mb-3">How do I update my availability?</h4>
                  <p className="text-gray-600">Tutors can update their availability from the <strong className="text-gray-900">Availability</strong> section in the dashboard. Make sure to save your changes.</p>
                </div>

                <div className="border-b border-gray-100 pb-6 last:border-b-0">
                  <h4 className="text-lg font-semibold text-gray-900 mb-3">How do I cancel a booking?</h4>
                  <p className="text-gray-600">Go to your <strong className="text-gray-900">Bookings</strong> page, find the session you want to cancel, and use the cancel option. Please review the cancellation policy before proceeding.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Contact Section */}
          <div className="card">
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Need More Help?</h3>
              <p className="text-gray-600 mb-4">Can't find what you're looking for? We're here to help!</p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <a href="mailto:support@classroomly.com" className="btn btn-primary">
                  Email Support
                </a>
                <a href="#" className="btn btn-secondary">
                  Live Chat
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 