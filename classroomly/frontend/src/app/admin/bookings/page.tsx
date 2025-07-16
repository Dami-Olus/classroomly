"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";

const PAGE_SIZE = 20;

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const fetchBookings = async () => {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem("authToken");
      if (!token) return;
      try {
        const res = await fetch(
          `http://localhost:4000/api/admin/bookings?search=${encodeURIComponent(search)}&page=${page}&limit=${PAGE_SIZE}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!res.ok) {
          setError("Failed to fetch bookings");
          setBookings([]);
          setTotal(0);
          setLoading(false);
          return;
        }
        const data = await res.json();
        setBookings(data.bookings);
        setTotal(data.total);
      } catch {
        setError("Failed to fetch bookings");
        setBookings([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    };
    fetchBookings();
  }, [search, page]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="min-h-screen bg-gray-50 p-10">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Booking Management</h1>
          <Link href="/admin" className="text-blue-600 hover:underline text-sm">← Back to Dashboard</Link>
        </header>
        <div className="mb-6 flex items-center justify-between">
          <input
            type="text"
            placeholder="Search bookings..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="form-input w-64"
          />
          <span className="text-gray-500 text-sm">{total} bookings</span>
        </div>
        <div className="card overflow-x-auto">
          <table className="min-w-full table">
            <thead className="table-header">
              <tr>
                <th className="table-header-cell">Class</th>
                <th className="table-header-cell">Student</th>
                <th className="table-header-cell">Tutor</th>
                <th className="table-header-cell">Scheduled At</th>
                <th className="table-header-cell">Status</th>
                <th className="table-header-cell">Payment</th>
                <th className="table-header-cell">Amount</th>
                <th className="table-header-cell">Created</th>
                <th className="table-header-cell">Actions</th>
              </tr>
            </thead>
            <tbody className="table-body">
              {loading ? (
                <tr><td colSpan={9} className="text-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div></td></tr>
              ) : error ? (
                <tr><td colSpan={9} className="text-center text-red-600 py-8">{error}</td></tr>
              ) : bookings.length === 0 ? (
                <tr><td colSpan={9} className="text-center text-gray-500 py-8">No bookings found.</td></tr>
              ) : (
                bookings.map((b) => (
                  <tr key={b.id} className="table-row">
                    <td className="table-cell font-medium">{b.class ? b.class.title : '-'}</td>
                    <td className="table-cell">{b.student ? `${b.student.firstName} ${b.student.lastName}` : '-'}</td>
                    <td className="table-cell">{b.class && b.class.tutor ? `${b.class.tutor.firstName} ${b.class.tutor.lastName}` : '-'}</td>
                    <td className="table-cell">{b.scheduledAt ? new Date(b.scheduledAt).toLocaleString() : '-'}</td>
                    <td className="table-cell">
                      <span className={`badge ${b.status === 'confirmed' ? 'badge-success' : b.status === 'cancelled' ? 'badge-danger' : b.status === 'completed' ? 'badge-info' : 'badge-warning'}`}>{b.status}</span>
                    </td>
                    <td className="table-cell">
                      <span className={`badge ${b.paymentStatus === 'paid' ? 'badge-success' : b.paymentStatus === 'refunded' ? 'badge-info' : 'badge-warning'}`}>{b.paymentStatus}</span>
                    </td>
                    <td className="table-cell">${b.totalAmount?.toFixed(2)}</td>
                    <td className="table-cell">{new Date(b.createdAt).toLocaleDateString()}</td>
                    <td className="table-cell">
                      <button className="btn btn-xs btn-outline">View</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {/* Pagination */}
        <div className="flex justify-between items-center mt-6">
          <button
            className="btn btn-secondary"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Previous
          </button>
          <span className="text-gray-600 text-sm">Page {page} of {totalPages || 1}</span>
          <button
            className="btn btn-secondary"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages || totalPages === 0}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
} 