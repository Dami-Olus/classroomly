"use client";
import React, { useState } from "react";
import Link from "next/link";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Sidebar */}
      <aside className={`bg-white border-r border-gray-200 flex flex-col py-8 px-2 transition-all duration-200 ${collapsed ? 'w-20' : 'w-64'}`}>
        <div className="mb-10 flex items-center justify-between px-4">
          <Link href="/admin" className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">A</span>
            </div>
            {!collapsed && <span className="text-xl font-bold text-gray-900">Admin</span>}
          </Link>
          <button
            className="ml-2 p-1 rounded hover:bg-gray-100 focus:outline-none"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={() => setCollapsed((c) => !c)}
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {collapsed ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              )}
            </svg>
          </button>
        </div>
        <nav className="flex-1 space-y-2">
          <Link href="/admin" className="block px-3 py-2 rounded-md text-gray-700 font-medium hover:bg-blue-50">Overview</Link>
          <Link href="/admin/users" className="block px-3 py-2 rounded-md text-gray-700 font-medium hover:bg-blue-50">Users</Link>
          <Link href="/admin/classes" className="block px-3 py-2 rounded-md text-gray-700 font-medium hover:bg-blue-50">Classes</Link>
          <Link href="/admin/bookings" className="block px-3 py-2 rounded-md text-gray-700 font-medium hover:bg-blue-50">Bookings</Link>
          <Link href="/admin/analytics" className="block px-3 py-2 rounded-md text-gray-700 font-medium hover:bg-blue-50">Analytics</Link>
          <Link href="/admin/logs" className="block px-3 py-2 rounded-md text-gray-700 font-medium hover:bg-blue-50">Logs</Link>
          <Link href="/admin/settings" className="block px-3 py-2 rounded-md text-gray-700 font-medium hover:bg-blue-50">Settings</Link>
        </nav>
      </aside>
      {/* Main Content */}
      <main className="flex-1 p-10">{children}</main>
    </div>
  );
} 