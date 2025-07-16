"use client";
import React, { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

const schema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email({ message: "Invalid email address" }),
  password: z.string().min(8, "Password must be at least 8 characters"),
  userType: z.enum(["TUTOR", "STUDENT"]),
  hourlyRate: z.preprocess(
    (val) => {
      if (val === "" || val === undefined || val === null) return undefined;
      const num = Number(val);
      return typeof num === "number" && !isNaN(num) ? num : undefined;
    },
    z.number().positive("Hourly rate must be positive").optional() as z.ZodType<number | undefined, any, any>
  ).optional(),
  subjects: z.array(z.string()).optional()
});

type FormData = z.infer<typeof schema>;

const SUBJECT_OPTIONS = [
  "Math", "Physics", "Chemistry", "Biology", "English", "History", "Programming"
];

export default function SignUpForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [apiSuccess, setApiSuccess] = useState<string | null>(null);
  // @ts-ignore
  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    formState: { errors, isSubmitting }
  } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });

  const userType = watch("userType");

  const onSubmit = async (data: z.infer<typeof schema>) => {
    setApiError(null);
    setApiSuccess(null);
    try {
      const res = await fetch("http://localhost:4000/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      const result = await res.json();
      if (!res.ok) {
        setApiError(result.message || "Registration failed");
        return;
      }
      setApiSuccess("Registration successful! Please check your email to verify your account.");
      // Store token and redirect to dashboard
      localStorage.setItem('authToken', result.token);
      window.location.href = '/dashboard';
      reset();
    } catch (err) {
      setApiError("An unexpected error occurred. Please try again.");
    }
  };

  return (
    <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
      <div className="flex gap-2">
        <div className="w-1/2">
          <label className="block text-sm font-medium text-gray-700">First Name</label>
          <input
            type="text"
            {...register("firstName")}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="Jane"
          />
          {errors.firstName && <p className="mt-1 text-xs text-red-600">{errors.firstName.message}</p>}
        </div>
        <div className="w-1/2">
          <label className="block text-sm font-medium text-gray-700">Last Name</label>
          <input
            type="text"
            {...register("lastName")}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="Doe"
          />
          {errors.lastName && <p className="mt-1 text-xs text-red-600">{errors.lastName.message}</p>}
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Email Address</label>
        <input
          type="email"
          autoComplete="email"
          {...register("email")}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="jane@example.com"
        />
        {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Password</label>
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            {...register("password")}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 pr-10 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="••••••••"
          />
          <button
            type="button"
            tabIndex={-1}
            className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? (
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-5 0-9-4-9-7s4-7 9-7c1.657 0 3.216.41 4.563 1.125M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            ) : (
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18M9.88 9.88A3 3 0 0112 9c1.657 0 3 1.343 3 3 0 .512-.13.995-.36 1.41M6.53 6.53A9.956 9.956 0 002.458 12C3.732 15.943 7.523 19 12 19c1.657 0 3.216-.41 4.563-1.125M17.47 17.47A9.956 9.956 0 0021.542 12c-.272-.857-.67-1.664-1.175-2.39" /></svg>
            )}
          </button>
        </div>
        {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>}
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">I am a</label>
        <select
          {...register("userType")}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">Select...</option>
          <option value="TUTOR">Tutor</option>
          <option value="STUDENT">Student</option>
        </select>
        {errors.userType && <p className="mt-1 text-xs text-red-600">{errors.userType.message}</p>}
      </div>
      {userType === "TUTOR" && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700">Hourly Rate ($)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              {...register("hourlyRate")}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="50"
            />
            {errors.hourlyRate && <p className="mt-1 text-xs text-red-600">{errors.hourlyRate.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Subjects</label>
            <Controller
              control={control}
              name="subjects"
              render={({ field }) => (
                <select
                  multiple
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  value={field.value || []}
                  onChange={e => {
                    const options = Array.from(e.target.selectedOptions, option => option.value);
                    field.onChange(options);
                  }}
                >
                  {SUBJECT_OPTIONS.map(subject => (
                    <option key={subject} value={subject}>{subject}</option>
                  ))}
                </select>
              )}
            />
            {errors.subjects && <p className="mt-1 text-xs text-red-600">{errors.subjects.message}</p>}
          </div>
        </>
      )}
      {apiError && <div className="text-red-600 text-sm text-center">{apiError}</div>}
      {apiSuccess && <div className="text-green-600 text-sm text-center">{apiSuccess}</div>}
      <button
        type="submit"
        className="w-full rounded-md bg-blue-600 py-2 px-4 text-white font-semibold hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        disabled={isSubmitting}
      >
        {isSubmitting ? "Signing Up..." : "Sign Up"}
      </button>
      <div className="flex items-center my-4">
        <div className="flex-grow border-t border-gray-200" />
        <span className="mx-2 text-gray-400 text-xs">or</span>
        <div className="flex-grow border-t border-gray-200" />
      </div>
      <button
        type="button"
        className="w-full flex items-center justify-center gap-2 rounded-md border border-gray-300 bg-white py-2 px-4 font-medium text-gray-700 shadow-sm hover:bg-gray-50"
      >
        <svg className="h-5 w-5" viewBox="0 0 48 48"><g><circle cx="24" cy="24" r="24" fill="#fff"/><path d="M44.5 20H24v8.5h11.7C34.7 33.7 29.8 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l6-6C34.5 5.5 29.6 3 24 3c-7.2 0-13.3 4.1-16.7 10.1z" fill="#34A853"/><path d="M24 44c5.6 0 10.5-1.9 14.4-5.1l-6.6-5.4C29.7 35.7 27 36.5 24 36.5c-5.7 0-10.5-3.7-12.2-8.7l-7 5.4C7.7 39.9 15.3 44 24 44z" fill="#FBBC05"/><path d="M44.5 20H24v8.5h11.7C34.7 33.7 29.8 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l6-6C34.5 5.5 29.6 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21c10.5 0 19.1-8.1 20.8-18.5H44.5z" fill="none"/></g></svg>
        Continue with Google
      </button>
      <button
        type="button"
        className="w-full flex items-center justify-center gap-2 rounded-md border border-gray-300 bg-white py-2 px-4 font-medium text-gray-700 shadow-sm hover:bg-gray-50"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24"><path fill="#1877F2" d="M24 12c0-6.627-5.373-12-12-12S0 5.373 0 12c0 6.006 4.438 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.413c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953h-1.513c-1.491 0-1.953.926-1.953 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.562 22.954 24 18.006 24 12z"/></svg>
        Continue with Facebook
      </button>
    </form>
  );
} 