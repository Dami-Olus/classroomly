"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";

const metricsList = [
  { label: "Total Users", key: "totalUsers", icon: "users" },
  { label: "Tutors", key: "totalTutors", icon: "chalkboard-teacher" },
  { label: "Students", key: "totalStudents", icon: "user-graduate" },
  { label: "Classes", key: "totalClasses", icon: "book" },
  { label: "Bookings", key: "totalBookings", icon: "calendar-check" },
  { label: "Revenue", key: "totalRevenue", icon: "dollar-sign" },
];

export default function AdminDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [metrics, setMetrics] = useState<any>(null);
  const [metricsError, setMetricsError] = useState<string | null>(null);

  useEffect(() => {
    const checkAdmin = async () => {
      const token = localStorage.getItem("authToken");
      if (!token) {
        setLoading(false);
        setIsAdmin(false);
        return;
      }
      try {
        const res = await fetch("http://localhost:4000/api/profile", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          setLoading(false);
          setIsAdmin(false);
          return;
        }
        const data = await res.json();
        if (data?.data?.userType === "ADMIN") {
          setIsAdmin(true);
        } else {
          setIsAdmin(false);
        }
      } catch {
        setIsAdmin(false);
      } finally {
        setLoading(false);
      }
    };
    checkAdmin();
  }, []);

  useEffect(() => {
    const fetchMetrics = async () => {
      setMetricsError(null);
      const token = localStorage.getItem("authToken");
      if (!token) return;
      try {
        const res = await fetch("http://localhost:4000/api/admin/metrics", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          setMetricsError("Failed to fetch metrics");
          return;
        }
        const data = await res.json();
        setMetrics(data);
      } catch {
        setMetricsError("Failed to fetch metrics");
      }
    };
    if (isAdmin) fetchMetrics();
  }, [isAdmin]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Checking admin access...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow text-center">
          <h1 className="text-2xl font-bold mb-2 text-red-600">Access Denied</h1>
          <p className="text-gray-600">You do not have permission to view this page.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <header className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
        <span className="text-sm text-gray-500">Beta</span>
      </header>
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
        {metricsList.map((m) => (
          <div key={m.label} className="card card-hover p-6 flex items-center space-x-4">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              {/* Placeholder icon */}
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" strokeWidth="2" />
                <path d="M12 8v4l3 3" strokeWidth="2" />
              </svg>
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">
                {metrics === null ? (
                  <span className="skeleton-text w-12 inline-block"></span>
                ) : metricsError ? (
                  <span className="text-red-600">--</span>
                ) : m.key === 'totalRevenue' ? (
                  `$${metrics[m.key]?.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
                ) : (
                  metrics[m.key]?.toLocaleString() ?? '--'
                )}
              </div>
              <div className="text-gray-600 text-sm">{m.label}</div>
            </div>
          </div>
        ))}
      </section>
      {metricsError && (
        <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded text-red-700 text-center">
          {metricsError}
        </div>
      )}
      <section>
        <div className="card p-8 text-center text-gray-500">
          <p>Welcome to the admin dashboard. Use the sidebar to manage users, classes, bookings, and view analytics. More features coming soon!</p>
        </div>
      </section>
    </>
  );
} 