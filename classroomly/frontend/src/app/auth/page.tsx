"use client";
import React, { useState } from "react";
import SignInForm from "../../components/auth/SignInForm";
import SignUpForm from "../../components/auth/SignUpForm";
import ForgotPasswordForm from "../../components/auth/ForgotPasswordForm";

export default function AuthPage() {
  const [tab, setTab] = useState<"signin" | "signup" | "forgot">("signin");

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 py-8 px-4">
      {/* Header */}
      <div className="flex flex-col items-center mb-8 animate-fadeInUp">
        <div className="w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg">
          <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5zm0 0v6m0-6l-9-5m9 5l9-5" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Classroomly</h1>
        <p className="text-gray-600 text-center max-w-sm">
          Connect with expert tutors and students for personalized learning experiences
        </p>
      </div>

      {/* Auth Card */}
      <div className="w-full max-w-md animate-fadeIn">
        <div className="card shadow-xl">
          {/* Tab Navigation */}
          <div className="flex border-b border-gray-200">
            <button
              className={`flex-1 py-4 text-center font-medium text-sm transition-all duration-200 ${
                tab === "signin" 
                  ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50" 
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              }`}
              onClick={() => setTab("signin")}
            >
              Sign In
            </button>
            <button
              className={`flex-1 py-4 text-center font-medium text-sm transition-all duration-200 ${
                tab === "signup" 
                  ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50" 
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              }`}
              onClick={() => setTab("signup")}
            >
              Sign Up
            </button>
          </div>

          {/* Content */}
          <div className="p-8">
            {tab === "signin" && (
              <div className="animate-slideIn">
                <div className="mb-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-2">Welcome back</h2>
                  <p className="text-gray-600">Sign in to your account to continue</p>
                </div>
                <SignInForm />
                <div className="mt-6 text-center">
                  <button
                    className="text-sm text-blue-600 hover:text-blue-700 hover:underline transition-colors"
                    onClick={() => setTab("forgot")}
                    type="button"
                  >
                    Forgot your password?
                  </button>
                </div>
              </div>
            )}

            {tab === "signup" && (
              <div className="animate-slideIn">
                <div className="mb-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-2">Create your account</h2>
                  <p className="text-gray-600">Join Classroomly to start learning or teaching</p>
                </div>
                <SignUpForm />
              </div>
            )}

            {tab === "forgot" && (
              <div className="animate-slideIn">
                <div className="mb-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-2">Reset your password</h2>
                  <p className="text-gray-600">Enter your email to receive reset instructions</p>
                </div>
                <ForgotPasswordForm />
                <div className="mt-6 text-center">
                  <button
                    className="text-sm text-blue-600 hover:text-blue-700 hover:underline transition-colors"
                    onClick={() => setTab("signin")}
                    type="button"
                  >
                    ← Back to Sign In
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500">
            By continuing, you agree to our{' '}
            <a href="#" className="text-blue-600 hover:underline">Terms of Service</a>
            {' '}and{' '}
            <a href="#" className="text-blue-600 hover:underline">Privacy Policy</a>
          </p>
        </div>
      </div>
    </div>
  );
} 