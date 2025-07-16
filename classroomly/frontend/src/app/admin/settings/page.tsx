"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem("authToken");
      if (!token) return;
      try {
        const res = await fetch("http://localhost:4000/api/admin/settings", { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) throw new Error("Failed to fetch settings");
        setSettings(await res.json());
      } catch {
        setError("Failed to fetch settings");
        setSettings(null);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSettings({ ...settings, [e.target.name]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    const token = localStorage.getItem("authToken");
    if (!token) return;
    try {
      const res = await fetch("http://localhost:4000/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(settings)
      });
      if (!res.ok) throw new Error("Failed to save settings");
      setSuccess("Settings updated successfully");
    } catch {
      setError("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-10">
      <div className="max-w-2xl mx-auto">
        <header className="mb-8 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Platform Settings</h1>
          <Link href="/admin" className="text-blue-600 hover:underline text-sm">← Back to Dashboard</Link>
        </header>
        <div className="card p-6">
          {loading ? (
            <div className="text-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div></div>
          ) : error ? (
            <div className="text-center text-red-600 py-8">{error}</div>
          ) : settings ? (
            <form onSubmit={e => { e.preventDefault(); handleSave(); }}>
              <div className="mb-4 flex items-center">
                <label htmlFor="maintenanceMode" className="mr-4 font-medium">Maintenance Mode</label>
                <input
                  id="maintenanceMode"
                  name="maintenanceMode"
                  type="checkbox"
                  checked={!!settings.maintenanceMode}
                  onChange={handleChange}
                  className="form-checkbox h-5 w-5"
                />
              </div>
              <div className="mb-4 flex items-center">
                <label htmlFor="featureX" className="mr-4 font-medium">Feature X</label>
                <input
                  id="featureX"
                  name="featureX"
                  type="checkbox"
                  checked={!!settings.featureX}
                  onChange={handleChange}
                  className="form-checkbox h-5 w-5"
                />
              </div>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Saving..." : "Save Settings"}</button>
              {success && <div className="text-green-600 mt-4">{success}</div>}
              {error && <div className="text-red-600 mt-4">{error}</div>}
            </form>
          ) : null}
        </div>
      </div>
    </div>
  );
} 