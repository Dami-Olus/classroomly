"use client";
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import VideoSession from '@/components/video/VideoSession';
import { useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import RescheduleModal from '@/components/reschedule/RescheduleModal';
import RescheduleRequestsList, { RescheduleRequest } from '@/components/reschedule/RescheduleRequestsList';
import { toast } from 'react-hot-toast';
import { addDays, format, isBefore, isEqual, isAfter, set, getDay, parseISO } from 'date-fns';
import { getAvailableStartTimes } from '@/components/tutor/getAvailableStartTimes';
import { Slot, Booking } from '@/components/tutor/TutorBookingCalendar';
import ChatInterface from '@/components/chat/ChatInterface';

interface SessionData {
  id: string;
  bookingId: string;
  classId: string;
  tutorId: string;
  studentId: string;
  startTime: string;
  endTime: string;
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  class: {
    title: string;
    subject: string;
  };
  tutor: {
    firstName: string;
    lastName: string;
  };
  student: {
    firstName: string;
    lastName: string;
  };
}

interface User {
  id: string;
  userType: 'TUTOR' | 'STUDENT';
  firstName: string;
  lastName: string;
}

function MaterialsPanel({ sessionId, classId, user }: { sessionId: string, classId: string, user: any }) {
  const [materials, setMaterials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [tag, setTag] = useState('classwork');
  const [description, setDescription] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const TAG_OPTIONS = [
    { value: 'classwork', label: 'Classwork', color: 'bg-blue-100 text-blue-800' },
    { value: 'assignment', label: 'Assignment', color: 'bg-green-100 text-green-800' },
    { value: 'practice', label: 'Practice', color: 'bg-yellow-100 text-yellow-800' },
    { value: 'test', label: 'Test', color: 'bg-red-100 text-red-800' },
  ];
  const MAX_SIZE_MB = 10;
  const ALLOWED_TYPES = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/png',
    'image/jpeg',
    'image/jpg',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
  ];

  // Fetch materials
  useEffect(() => {
    let subscription: any;
    const fetchMaterials = async () => {
      setLoading(true);
      setError(null);
      try {
        const token = localStorage.getItem('authToken');
        const res = await fetch(`http://localhost:4000/api/materials?sessionId=${sessionId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (res.ok) setMaterials(data.data);
        else setError(data.message || 'Failed to fetch materials');
      } catch (err) {
        setError('Failed to fetch materials');
      } finally {
        setLoading(false);
      }
    };
    fetchMaterials();
    // Subscribe to realtime updates
    subscription = supabase
      .channel('materials')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'materials',
          filter: `session_id=eq.${sessionId}`
        },
        (payload) => {
          setMaterials((prev) => {
            if (prev.some((m) => m.id === payload.new.id)) return prev;
            return [...prev, payload.new];
          });
        }
      )
      .subscribe();
    return () => {
      if (subscription) supabase.removeChannel(subscription);
    };
  }, [sessionId]);

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    setUploadSuccess(null);
    const selected = e.target.files?.[0] || null;
    if (!selected) return setFile(null);
    if (!ALLOWED_TYPES.includes(selected.type)) {
      setUploadError('Unsupported file type.');
      setFile(null);
      return;
    }
    if (selected.size > MAX_SIZE_MB * 1024 * 1024) {
      setUploadError('File is too large (max 10MB).');
      setFile(null);
      return;
    }
    setFile(selected);
  };

  // Handle upload
  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadError(null);
    setUploadSuccess(null);
    if (!file) {
      setUploadError('Please select a file.');
      return;
    }
    setUploading(true);
    try {
      // 1. Upload to Supabase Storage
      const ext = file.name.split('.').pop();
      const filePath = `${sessionId}/${Date.now()}_${file.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage.from('materials').upload(filePath, file, { upsert: false });
      if (uploadError) throw new Error(uploadError.message);
      // 2. Get public URL
      const { data: publicUrlData } = supabase.storage.from('materials').getPublicUrl(filePath);
      const fileUrl = publicUrlData?.publicUrl;
      if (!fileUrl) throw new Error('Failed to get file URL');
      // 3. Call backend to create material record
      const token = localStorage.getItem('authToken');
      const res = await fetch('http://localhost:4000/api/materials', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          sessionId,
          classId,
          url: fileUrl,
          name: file.name,
          tag,
          description,
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to save material');
      setUploadSuccess('File uploaded successfully!');
      setFile(null);
      setDescription('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      setUploadError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="font-semibold text-lg mb-2">Materials</div>
      <form onSubmit={handleUpload} className="flex flex-col gap-2 mb-4" aria-label="Upload Material">
        <input
          type="file"
          accept={ALLOWED_TYPES.join(',')}
          onChange={handleFileChange}
          ref={fileInputRef}
          className="block w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          aria-label="Select file to upload"
        />
        <div className="flex gap-2">
          <select
            value={tag}
            onChange={e => setTag(e.target.value)}
            className="rounded border px-2 py-1 text-sm"
            aria-label="Material tag"
          >
            {TAG_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <input
            type="text"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Description (optional)"
            className="flex-1 rounded border px-2 py-1 text-sm"
            aria-label="Material description"
          />
          <button
            type="submit"
            className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
            disabled={uploading || !file}
            aria-disabled={uploading || !file}
          >
            {uploading ? 'Uploading...' : 'Upload'}
          </button>
        </div>
        {uploadError && <div className="text-red-600 text-xs mt-1">{uploadError}</div>}
        {uploadSuccess && <div className="text-green-600 text-xs mt-1">{uploadSuccess}</div>}
      </form>
      <div className="flex-1 bg-white rounded-lg shadow-inner p-2 mb-2 overflow-y-auto">
        {loading ? (
          <div className="text-gray-400 text-center py-8">Loading materials...</div>
        ) : error ? (
          <div className="text-red-500 text-center py-8">{error}</div>
        ) : materials.length === 0 ? (
          <div className="text-gray-400 text-center py-8">No materials uploaded yet.</div>
        ) : (
          <div className="space-y-3">
            {materials.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((mat) => {
              const tagObj = TAG_OPTIONS.find(t => t.value === mat.tag) || TAG_OPTIONS[0];
              return (
                <div key={mat.id} className="flex items-center gap-3 p-2 rounded border hover:bg-gray-50">
                  <span className={`px-2 py-1 rounded text-xs font-semibold ${tagObj.color}`}>{tagObj.label}</span>
                  <a href={mat.url} target="_blank" rel="noopener noreferrer" className="text-blue-700 underline break-all max-w-xs" download>{mat.name}</a>
                  {mat.description && <span className="text-gray-500 text-xs ml-2">{mat.description}</span>}
                  <span className="ml-auto text-xs text-gray-400">{new Date(mat.createdAt).toLocaleString()}</span>
                  <span className="text-xs text-gray-500 ml-2">by {mat.uploaderType === 'TUTOR' ? 'Tutor' : 'Student'}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function SessionPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;

  const [session, setSession] = useState<SessionData | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'materials'>('chat');
  const [rescheduleModalOpen, setRescheduleModalOpen] = useState(false);
  const [rescheduleLoading, setRescheduleLoading] = useState(false);
  const [rescheduleError, setRescheduleError] = useState<string | null>(null);
  const [rescheduleRequests, setRescheduleRequests] = useState<RescheduleRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [requestsError, setRequestsError] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [availableSlots, setAvailableSlots] = useState<{ value: string; label: string }[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [availability, setAvailability] = useState<Slot[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [availableDates, setAvailableDates] = useState<Date[]>([]);
  const [slotsForDate, setSlotsForDate] = useState<{ value: string; label: string }[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [loadingAvailability, setLoadingAvailability] = useState(false);

  // Fetch reschedule requests for this booking
  const fetchRescheduleRequests = async () => {
    if (!session) return;
    setRequestsLoading(true);
    setRequestsError(null);
    try {
      const token = localStorage.getItem('authToken');
      const res = await fetch(`http://localhost:4000/api/bookings/${session.bookingId}/reschedule`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) setRescheduleRequests(data.data);
      else setRequestsError(data.message || 'Failed to fetch reschedule requests');
    } catch (err) {
      setRequestsError('Failed to fetch reschedule requests');
    } finally {
      setRequestsLoading(false);
    }
  };

  useEffect(() => {
    if (session) fetchRescheduleRequests();
    // eslint-disable-next-line
  }, [sessionId, session?.bookingId]);

  // Propose a new reschedule
  const handleProposeReschedule = async (data: { proposedTime: string }) => {
    if (!session) return;
    console.log('Proposing reschedule for bookingId:', session.bookingId);
    setRescheduleLoading(true);
    setRescheduleError(null);
    try {
      const token = localStorage.getItem('authToken');
      const res = await fetch(`http://localhost:4000/api/bookings/${session.bookingId}/reschedule`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ proposedTime: data.proposedTime })
      });
      const result = await res.json();
      if (res.ok) {
        setRescheduleModalOpen(false);
        fetchRescheduleRequests();
        toast.success('Reschedule request sent!');
      } else {
        setRescheduleError(result.message || 'Failed to propose reschedule');
        toast.error(result.message || 'Failed to propose reschedule');
      }
    } catch (err) {
      setRescheduleError('Failed to propose reschedule');
      toast.error('Failed to propose reschedule');
    } finally {
      setRescheduleLoading(false);
    }
  };

  // Accept a reschedule request
  const handleAccept = async (requestId: string) => {
    if (!session) return;
    setActionLoadingId(requestId);
    setRequestsError(null);
    try {
      const token = localStorage.getItem('authToken');
      const res = await fetch(`http://localhost:4000/api/bookings/${session.bookingId}/reschedule/${requestId}/accept`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await res.json();
      if (res.ok) {
        fetchRescheduleRequests();
        fetchSession();
        toast.success('Reschedule accepted!');
      } else {
        setRequestsError(result.message || 'Failed to accept reschedule');
        toast.error(result.message || 'Failed to accept reschedule');
      }
    } catch (err) {
      setRequestsError('Failed to accept reschedule');
      toast.error('Failed to accept reschedule');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Decline a reschedule request
  const handleDecline = async (requestId: string) => {
    if (!session) return;
    setActionLoadingId(requestId);
    setRequestsError(null);
    try {
      const token = localStorage.getItem('authToken');
      const res = await fetch(`http://localhost:4000/api/bookings/${session.bookingId}/reschedule/${requestId}/decline`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await res.json();
      if (res.ok) {
        fetchRescheduleRequests();
        toast.success('Reschedule declined.');
      } else {
        setRequestsError(result.message || 'Failed to decline reschedule');
        toast.error(result.message || 'Failed to decline reschedule');
      }
    } catch (err) {
      setRequestsError('Failed to decline reschedule');
      toast.error('Failed to decline reschedule');
    } finally {
      setActionLoadingId(null);
    }
  };

  useEffect(() => {
    // Get user info from token
    const token = localStorage.getItem('authToken');
    if (!token) {
      router.push('/login');
      return;
    }

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const userData: User = {
        id: payload.id,
        userType: payload.userType,
        firstName: payload.firstName,
        lastName: payload.lastName
      };
      setUser(userData);
    } catch (error) {
      console.error('Error parsing token:', error);
      router.push('/login');
      return;
    }

    fetchSession();
  }, [sessionId]);

  const fetchSession = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`http://localhost:4000/api/sessions/${sessionId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const result = await response.json();
        setSession(result.data);
        console.log('Fetched session:', result.data);

        // Check if user is authorized for this session
        if (user && result.data) {
          const isAuthorized =
            (user.userType === 'TUTOR' && result.data.tutorId === user.id) ||
            (user.userType === 'STUDENT' && result.data.studentId === user.id);

          if (!isAuthorized) {
            setError('You are not authorized to access this session.');
          }
        }
      } else {
        const result = await response.json();
        setError(result.message || 'Failed to fetch session');
      }
    } catch (err) {
      setError('An error occurred while fetching session');
    } finally {
      setLoading(false);
    }
  };

  const startSession = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`http://localhost:4000/api/sessions/${sessionId}/start`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        setSessionStarted(true);
        // Update session status locally
        if (session) {
          setSession({ ...session, status: 'IN_PROGRESS' });
        }
      } else {
        const result = await response.json();
        alert(result.message || 'Failed to start session');
      }
    } catch (err) {
      alert('An error occurred while starting session');
    }
  };

  const joinSession = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`http://localhost:4000/api/sessions/${sessionId}/join`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        setSessionStarted(true);
      } else {
        const result = await response.json();
        alert(result.message || 'Failed to join session');
      }
    } catch (err) {
      alert('An error occurred while joining session');
    }
  };

  const handleSessionEnd = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`http://localhost:4000/api/sessions/${sessionId}/end`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        setSessionEnded(true);
        // Update session status locally
        if (session) {
          setSession({ ...session, status: 'COMPLETED' });
        }
      } else {
        const result = await response.json();
        alert(result.message || 'Failed to end session');
      }
    } catch (err) {
      alert('An error occurred while ending session');
    }
  };

  // Helper: Generate available slots for the next 14 days
  const generateAvailableSlots = async () => {
    if (!session) return;
    setLoadingSlots(true);
    try {
      // Fetch tutor availability
      const res = await fetch(`/api/availability/${session.tutorId}`);
      const data = await res.json();
      const slots = data.data || [];
      // Build a map: dayOfWeek -> [{startTime, endTime, timezone}]
      const slotMap: Record<number, { startTime: string; endTime: string; timezone: string }[]> = {};
      slots.forEach((slot: any) => {
        if (!slotMap[slot.dayOfWeek]) slotMap[slot.dayOfWeek] = [];
        slotMap[slot.dayOfWeek].push({ startTime: slot.startTime, endTime: slot.endTime, timezone: slot.timezone });
      });
      // Generate slots for next 14 days
      const now = new Date();
      const slotOptions: { value: string; label: string }[] = [];
      for (let i = 0; i < 14; i++) {
        const day = addDays(now, i);
        const dow = getDay(day);
        const daySlots = slotMap[dow] || [];
        for (const s of daySlots) {
          // Parse start/end time in tutor's timezone (assume local for now)
          const [startHour, startMinute] = s.startTime.split(':').map(Number);
          const [endHour, endMinute] = s.endTime.split(':').map(Number);
          // Build slot start/end as Date objects
          const slotStart = set(day, { hours: startHour, minutes: startMinute, seconds: 0, milliseconds: 0 });
          const slotEnd = set(day, { hours: endHour, minutes: endMinute, seconds: 0, milliseconds: 0 });
          // Only include future slots
          if (isAfter(slotStart, now)) {
            // For now, assume 1-hour slots (can be improved)
            slotOptions.push({
              value: slotStart.toISOString(),
              label: `${format(slotStart, 'EEE, MMM d, h:mm a')} - ${format(slotEnd, 'h:mm a')} (${s.timezone})`
            });
          }
        }
      }
      setAvailableSlots(slotOptions);
    } catch (err) {
      setAvailableSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  };

  // Fetch tutor availability and bookings on modal open
  const openRescheduleModal = async () => {
    setRescheduleModalOpen(true);
    setLoadingAvailability(true);
    try {
      // Fetch availability
      const availRes = await fetch(`/api/availability/${session?.tutorId}`);
      const availData = await availRes.json();
      setAvailability(availData.data || []);
      // Fetch bookings
      const bookRes = await fetch(`/api/bookings/tutor/${session?.tutorId}?status=PENDING&status=CONFIRMED`);
      const bookData = await bookRes.json();
      setBookings(bookData.data || []);
      // Compute available dates for next 14 days
      const now = new Date();
      const dates: Date[] = [];
      for (let i = 0; i < 14; i++) {
        const day = new Date(now);
        day.setDate(now.getDate() + i);
        // If there are any available slots for this day, include it
        const slots = getAvailableStartTimes(day, availData.data || [], bookData.data || [], 60);
        if (slots.length > 0) {
          dates.push(day);
        }
      }
      setAvailableDates(dates);
      setSelectedDate(null);
      setSlotsForDate([]);
    } catch (err) {
      setAvailability([]);
      setBookings([]);
      setAvailableDates([]);
      setSlotsForDate([]);
    } finally {
      setLoadingAvailability(false);
    }
  };

  // When a date is selected, compute slots for that date
  const handleDateChange = (date: Date) => {
    setSelectedDate(date);
    setLoadingSlots(true);
    setTimeout(() => {
      const slots = getAvailableStartTimes(date, availability, bookings, 60);
      setSlotsForDate(slots
        .filter(s => !s.booking) // Only show slots with no booking/conflict
        .map(s => ({
          value: s.start.toISOString(),
          label: `${s.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${s.slot.endTime}`
        })));
      setLoadingSlots(false);
    }, 0);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
          <div className="text-center">
            <div className="text-red-500 text-6xl mb-4">⚠️</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <button
              onClick={() => router.push('/dashboard')}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
          <div className="text-center">
            <div className="text-gray-500 text-6xl mb-4">❌</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Session Not Found</h2>
            <p className="text-gray-600 mb-4">The session you're looking for doesn't exist.</p>
            <button
              onClick={() => router.push('/dashboard')}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // If session has ended, show summary
  if (session && (sessionEnded || session.status === 'COMPLETED' || session.status === 'CANCELLED')) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
          <div className="text-center">
            <div className="text-green-500 text-6xl mb-4">✅</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Session Completed</h2>
            <p className="text-gray-600 mb-4">
              Your session has ended. Thank you for using our platform!
            </p>
            <div className="space-y-2 text-sm text-gray-600 mb-6">
              <p><strong>Class:</strong> {session.class.title}</p>
              <p><strong>Subject:</strong> {session.class.subject}</p>
              <p><strong>Tutor:</strong> {session.tutor.firstName} {session.tutor.lastName}</p>
            </div>
            <div className="space-y-2">
              <button
                onClick={() => router.push('/dashboard')}
                className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
              >
                Back to Dashboard
              </button>
              <button
                onClick={() => router.push(`/classes/${session.classId}`)}
                className="w-full bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700"
              >
                Book Another Session
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // If session is in progress, show video interface
  if (session && (sessionStarted || session.status === 'IN_PROGRESS')) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* Header */}
        <div className="bg-white shadow p-4 flex flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-xl font-bold text-gray-900">{session?.class.title}</div>
            <div className="text-gray-600">{session?.class.subject}</div>
            <div className="text-sm text-gray-500 mt-1">
              Tutor: {session?.tutor.firstName} {session?.tutor.lastName} | Student: {session?.student.firstName} {session?.student.lastName}
            </div>
            <div className="text-xs text-gray-400 mt-1">Session ID: {session?.id}</div>
          </div>
          <div className="mt-4 md:mt-0 flex items-center space-x-2">
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
              session?.status === 'IN_PROGRESS' ? 'bg-green-100 text-green-700' :
              session?.status === 'COMPLETED' ? 'bg-blue-100 text-blue-700' :
              session?.status === 'CANCELLED' ? 'bg-red-100 text-red-700' :
              'bg-yellow-100 text-yellow-700'
            }`}>
              {session?.status || ''}
            </span>
          </div>
        </div>
        {/* Main Content */}
        <div className="flex-1 flex flex-col md:flex-row gap-4 p-4">
          {/* Video Area */}
          <div className="md:w-2/3 w-full mb-4 md:mb-0">
            {session && user && (
              <VideoSession
                sessionId={session.id}
                userId={user.id}
                userType={user.userType}
                onSessionEnd={handleSessionEnd}
              />
            )}
          </div>
          {/* Tabs for Chat/Materials */}
          <div className="md:w-1/3 w-full flex flex-col h-[600px] min-h-[400px]">
            <div className="flex mb-2 border-b">
              <button
                className={`flex-1 py-2 font-semibold ${activeTab === 'chat' ? 'border-b-2 border-blue-600 text-blue-700' : 'text-gray-500'}`}
                onClick={() => setActiveTab('chat')}
              >
                Chat
              </button>
              <button
                className={`flex-1 py-2 font-semibold ${activeTab === 'materials' ? 'border-b-2 border-blue-600 text-blue-700' : 'text-gray-500'}`}
                onClick={() => setActiveTab('materials')}
              >
                Materials
              </button>
            </div>
            <div className="flex-1 overflow-y-auto bg-gray-50 rounded-lg shadow p-2">
              {activeTab === 'chat' ? (
                <ChatInterface
                  sessionId={session?.id}
                  currentUserId={user?.id}
                  currentUserName={`${user?.firstName} ${user?.lastName}`}
                  isVideoSession={true}
                />
              ) : (
                <MaterialsPanel sessionId={session?.id} classId={session?.classId} user={user} />
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Pre-session waiting room
  const canReschedule = session && ['SCHEDULED', 'IN_PROGRESS'].includes(session.status) && user && (user.id === session.tutorId || user.id === session.studentId);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto py-8 px-4">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          {/* Header */}
          <div className="bg-blue-600 text-white p-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-2xl font-bold">Session Waiting Room</h1>
                <p className="text-blue-100">Session ID: {sessionId}</p>
              </div>
              <div className="text-right">
                <div className="text-sm text-blue-100">Status</div>
                <div className="text-lg font-semibold capitalize">{session.status.replace('_', ' ')}</div>
              </div>
            </div>
          </div>

          {/* Session Details */}
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Session Information</h2>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Class</label>
                    <p className="text-gray-900">{session.class.title}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Subject</label>
                    <p className="text-gray-900">{session.class.subject}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Start Time</label>
                    <p className="text-gray-900">
                      {new Date(session.startTime).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Duration</label>
                    <p className="text-gray-900">
                      {Math.round((new Date(session.endTime).getTime() - new Date(session.startTime).getTime()) / (1000 * 60))} minutes
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Participants</h2>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Tutor</label>
                    <p className="text-gray-900">{session.tutor.firstName} {session.tutor.lastName}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Student</label>
                    <p className="text-gray-900">{session.student.firstName} {session.student.lastName}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-8 flex justify-center">
              {user?.userType === 'TUTOR' ? (
                <button
                  onClick={startSession}
                  className="bg-green-600 text-white px-8 py-3 rounded-md hover:bg-green-700 text-lg font-semibold"
                >
                  Start Class
                </button>
              ) : (
                <button
                  onClick={joinSession}
                  className="bg-blue-600 text-white px-8 py-3 rounded-md hover:bg-blue-700 text-lg font-semibold"
                >
                  Join Class
                </button>
              )}
            </div>

            {/* Instructions */}
            <div className="mt-8 bg-gray-50 p-4 rounded-lg">
              <h3 className="font-semibold text-gray-900 mb-2">Before you begin:</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Make sure your camera and microphone are working</li>
                <li>• Find a quiet place with good lighting</li>
                <li>• Have your materials ready</li>
                <li>• Test your internet connection</li>
              </ul>
            </div>
          </div>
        </div>
        {canReschedule && (
          <div className="mb-6">
            <button
              className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
              onClick={openRescheduleModal}
            >
              Propose Reschedule
            </button>
          </div>
        )}
        <RescheduleModal
          isOpen={rescheduleModalOpen}
          onClose={() => setRescheduleModalOpen(false)}
          onSubmit={handleProposeReschedule}
          availableDates={availableDates}
          slotsForDate={slotsForDate}
          onDateChange={handleDateChange}
          loadingSlots={loadingSlots || loadingAvailability}
          error={rescheduleError}
        />
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-2">Reschedule Requests</h3>
          {requestsLoading ? (
            <div className="text-gray-400">Loading reschedule requests...</div>
          ) : (
            <RescheduleRequestsList
              requests={rescheduleRequests}
              currentUserId={user?.id || ''}
              onAccept={handleAccept}
              onDecline={handleDecline}
              loadingId={actionLoadingId}
              error={requestsError}
            />
          )}
        </div>
      </div>
    </div>
  );
} 