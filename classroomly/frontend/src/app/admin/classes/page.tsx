"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";

const PAGE_SIZE = 20;

export default function AdminClassesPage() {
  const [classes, setClasses] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const fetchClasses = async () => {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem("authToken");
      if (!token) return;
      try {
        const res = await fetch(
          `http://localhost:4000/api/admin/classes?search=${encodeURIComponent(search)}&page=${page}&limit=${PAGE_SIZE}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!res.ok) {
          setError("Failed to fetch classes");
          setClasses([]);
          setTotal(0);
          setLoading(false);
          return;
        }
        const data = await res.json();
        setClasses(data.classes);
        setTotal(data.total);
      } catch {
        setError("Failed to fetch classes");
        setClasses([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    };
    fetchClasses();
  }, [search, page]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="min-h-screen bg-gray-50 p-10">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Class Management</h1>
          <Link href="/admin" className="text-blue-600 hover:underline text-sm">← Back to Dashboard</Link>
        </header>
        <div className="mb-6 flex items-center justify-between">
          <input
            type="text"
            placeholder="Search classes..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="form-input w-64"
          />
          <span className="text-gray-500 text-sm">{total} classes</span>
        </div>
        <div className="card overflow-x-auto">
          <table className="min-w-full table">
            <thead className="table-header">
              <tr>
                <th className="table-header-cell">Title</th>
                <th className="table-header-cell">Subject</th>
                <th className="table-header-cell">Level</th>
                <th className="table-header-cell">Tutor</th>
                <th className="table-header-cell">Max Students</th>
                <th className="table-header-cell">Enrolled</th>
                <th className="table-header-cell">Price</th>
                <th className="table-header-cell">Status</th>
                <th className="table-header-cell">Created</th>
                <th className="table-header-cell">Actions</th>
              </tr>
            </thead>
            <tbody className="table-body">
              {loading ? (
                <tr><td colSpan={10} className="text-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div></td></tr>
              ) : error ? (
                <tr><td colSpan={10} className="text-center text-red-600 py-8">{error}</td></tr>
              ) : classes.length === 0 ? (
                <tr><td colSpan={10} className="text-center text-gray-500 py-8">No classes found.</td></tr>
              ) : (
                classes.map((cls) => (
                  <tr key={cls.id} className="table-row">
                    <td className="table-cell font-medium">{cls.title}</td>
                    <td className="table-cell">{cls.subject}</td>
                    <td className="table-cell">{cls.level || '-'}</td>
                    <td className="table-cell">{cls.tutor ? `${cls.tutor.firstName} ${cls.tutor.lastName}` : '-'}</td>
                    <td className="table-cell">{cls.maxStudents}</td>
                    <td className="table-cell">{cls.enrolledCount}</td>
                    <td className="table-cell">${cls.pricePerSession?.toFixed(2)}</td>
                    <td className="table-cell">
                      {cls.isActive ? (
                        <span className="badge badge-success">Active</span>
                      ) : (
                        <span className="badge badge-danger">Inactive</span>
                      )}
                    </td>
                    <td className="table-cell">{new Date(cls.createdAt).toLocaleDateString()}</td>
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