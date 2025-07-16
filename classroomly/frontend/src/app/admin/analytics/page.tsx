"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";

const ResponsiveLineChart = dynamic(() => import("./charts/ResponsiveLineChart"), { ssr: false });
const ResponsiveBarChart = dynamic(() => import("./charts/ResponsiveBarChart"), { ssr: false });

interface SignupAnalyticsPoint { date: string; count: number; }
interface BookingAnalyticsPoint { date: string; count: number; }
interface RevenueAnalyticsPoint { date: string; amount: number; }

export default function AdminAnalyticsPage() {
  const [signups, setSignups] = useState<SignupAnalyticsPoint[]>([]);
  const [bookings, setBookings] = useState<BookingAnalyticsPoint[]>([]);
  const [revenue, setRevenue] = useState<RevenueAnalyticsPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem("authToken");
      if (!token) return;
      try {
        const [s, b, r] = await Promise.all([
          fetch("http://localhost:4000/api/admin/analytics/signups", { headers: { Authorization: `Bearer ${token}` } }),
          fetch("http://localhost:4000/api/admin/analytics/bookings", { headers: { Authorization: `Bearer ${token}` } }),
          fetch("http://localhost:4000/api/admin/analytics/revenue", { headers: { Authorization: `Bearer ${token}` } })
        ]);
        if (!s.ok || !b.ok || !r.ok) throw new Error("Failed to fetch analytics");
        setSignups((await s.json()).data);
        setBookings((await b.json()).data);
        setRevenue((await r.json()).data);
      } catch {
        setError("Failed to fetch analytics");
        setSignups([]);
        setBookings([]);
        setRevenue([]);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-10">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <Link href="/admin" className="text-blue-600 hover:underline text-sm">← Back to Dashboard</Link>
        </header>
        {loading ? (
          <div className="text-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div></div>
        ) : error ? (
          <div className="text-center text-red-600 py-8">{error}</div>
        ) : (
          <div className="space-y-10">
            <section>
              <h2 className="font-semibold mb-2">User Signups (last 30 days)</h2>
              <div className="card p-4">
                <ResponsiveLineChart data={signups} dataKey="count" color="#6366f1" label="Signups" />
              </div>
            </section>
            <section>
              <h2 className="font-semibold mb-2">Bookings (last 30 days)</h2>
              <div className="card p-4">
                <ResponsiveLineChart data={bookings} dataKey="count" color="#10b981" label="Bookings" />
              </div>
            </section>
            <section>
              <h2 className="font-semibold mb-2">Revenue (last 30 days)</h2>
              <div className="card p-4">
                <ResponsiveBarChart data={revenue} dataKey="amount" color="#f59e42" label="Revenue" />
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
} 