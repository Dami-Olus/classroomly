import React, { useEffect, useState } from 'react';

const daysOfWeek = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
];

interface TimeRange {
  id: string;
  startTime: string;
  endTime: string;
}

interface DayAvailability {
  enabled: boolean;
  timeRanges: TimeRange[];
}

interface AvailabilityState {
  [day: number]: DayAvailability;
}

function getDefaultAvailability(): AvailabilityState {
  const state: AvailabilityState = {};
  for (let i = 0; i < 7; i++) {
    state[i] = { enabled: false, timeRanges: [] };
  }
  return state;
}

const TutorAvailabilityManager: React.FC<{ 
  tutorId: string;
  onAvailabilityChange?: () => void;
}> = ({ tutorId, onAvailabilityChange }) => {
  const [availability, setAvailability] = useState<AvailabilityState>(getDefaultAvailability());
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalDay, setModalDay] = useState<number | null>(null);
  const [editRange, setEditRange] = useState<{ id?: string; startTime: string; endTime: string } | null>(null);
  const [timezone, setTimezone] = useState<string>(Intl.DateTimeFormat().resolvedOptions().timeZone);

  // Fetch availability from API
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const res = await fetch(`http://localhost:4000/api/availability/${tutorId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      // Transform API data to AvailabilityState
      const state = getDefaultAvailability();
      (data.data || []).forEach((slot: any) => {
        const day = slot.dayOfWeek;
        if (!state[day].enabled) state[day].enabled = true;
        state[day].timeRanges.push({
          id: slot.id,
          startTime: slot.startTime,
          endTime: slot.endTime
        });
      });
      setAvailability(state);
      if (data.data && data.data.length > 0 && data.data[0].timezone) {
        setTimezone(data.data[0].timezone);
      }
      setLoading(false);
    }
    if (tutorId) fetchData();
  }, [tutorId]);

  // Toggle day availability
  const handleToggleDay = (day: number) => {
    setAvailability(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        enabled: !prev[day].enabled,
        timeRanges: !prev[day].enabled ? prev[day].timeRanges : [] // clear if disabling
      }
    }));
    onAvailabilityChange?.(); // Notify parent of change
    
    // Dispatch custom event to notify calendar of availability change
    window.dispatchEvent(new CustomEvent('availabilityChanged'));
  };

  // Open modal to add/edit time range
  const openModal = (day: number, range?: TimeRange) => {
    setModalDay(day);
    setEditRange(range ? { id: range.id, startTime: range.startTime, endTime: range.endTime } : { startTime: '', endTime: '' });
    setModalOpen(true);
  };

  // Save time range (add or edit)
  const handleSaveRange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (modalDay === null || !editRange) return;
    let newRanges = [...availability[modalDay].timeRanges];
    const token = localStorage.getItem('authToken');
    
    if (editRange.id) {
      // Edit
      newRanges = newRanges.map(r => r.id === editRange.id ? { ...r, startTime: editRange.startTime, endTime: editRange.endTime } : r);
      await fetch(`http://localhost:4000/api/availability/${tutorId}/${editRange.id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          dayOfWeek: modalDay,
          startTime: editRange.startTime,
          endTime: editRange.endTime,
          timezone
        })
      });
    } else {
      // Add
      const res = await fetch(`http://localhost:4000/api/availability/${tutorId}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          dayOfWeek: modalDay,
          startTime: editRange.startTime,
          endTime: editRange.endTime,
          timezone
        })
      });
      const data = await res.json();
      newRanges.push({ id: data.data.id || Math.random().toString(), startTime: editRange.startTime, endTime: editRange.endTime });
    }
    setAvailability(prev => ({
      ...prev,
      [modalDay]: {
        ...prev[modalDay],
        enabled: true,
        timeRanges: newRanges
      }
    }));
    setModalOpen(false);
    setEditRange(null);
    setModalDay(null);
    onAvailabilityChange?.(); // Notify parent of change
    
    // Dispatch custom event to notify calendar of availability change
    window.dispatchEvent(new CustomEvent('availabilityChanged'));
  };

  // Delete time range
  const handleDeleteRange = async (day: number, rangeId: string) => {
    const token = localStorage.getItem('authToken');
    await fetch(`http://localhost:4000/api/availability/${tutorId}/${rangeId}`, { 
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    setAvailability(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        timeRanges: prev[day].timeRanges.filter(r => r.id !== rangeId)
      }
    }));
    onAvailabilityChange?.(); // Notify parent of change
    
    // Dispatch custom event to notify calendar of availability change
    window.dispatchEvent(new CustomEvent('availabilityChanged'));
  };

  return (
    <div className="max-w-lg mx-auto bg-white rounded-lg shadow p-6 mt-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">My weekly availability</h3>
      </div>
      <p className="text-sm text-gray-500 mb-4">Set the times when you are available for meetings here. This will only apply to your booking page.</p>
      <div className="mb-4">
        <span className="text-xs text-gray-600">Timezone for your availability:</span>
        <span className="ml-2 font-medium text-gray-800">{timezone}</span>
      </div>
      {loading ? <div>Loading...</div> : (
        <div className="divide-y divide-gray-200">
          {daysOfWeek.map((day, idx) => (
            <div key={day} className="flex items-center py-3">
              <button
                className={`w-10 h-6 rounded-full mr-4 focus:outline-none transition-colors duration-200 ${availability[idx].enabled ? 'bg-green-500' : 'bg-gray-300'}`}
                onClick={() => handleToggleDay(idx)}
                aria-pressed={availability[idx].enabled}
                aria-label={`Toggle ${day}`}
              >
                <span className={`block w-6 h-6 bg-white rounded-full shadow transform transition-transform duration-200 ${availability[idx].enabled ? 'translate-x-4' : ''}`}></span>
              </button>
              <div className="flex-1">
                <div className="font-medium text-gray-900">{day}</div>
                {availability[idx].enabled && availability[idx].timeRanges.length > 0 ? (
                  <div className="flex flex-wrap gap-2 mt-1">
                    {availability[idx].timeRanges.map(range => (
                      <span key={range.id} className="inline-flex items-center bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-xs">
                        {range.startTime} - {range.endTime}
                        <button
                          className="ml-1 text-xs text-gray-500 hover:text-red-600"
                          onClick={() => handleDeleteRange(idx, range.id)}
                          aria-label="Delete time range"
                        >
                          ×
                        </button>
                        <button
                          className="ml-1 text-xs text-gray-500 hover:text-blue-600"
                          onClick={() => openModal(idx, range)}
                          aria-label="Edit time range"
                        >
                          Edit
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-gray-400 mt-1">Busy all day</div>
                )}
              </div>
              <button
                className="ml-4 px-3 py-1 text-xs bg-gray-100 rounded border border-gray-300 hover:bg-blue-50 text-blue-700"
                onClick={() => openModal(idx)}
              >
                Edit
              </button>
            </div>
          ))}
        </div>
      )}
      {/* Modal for editing/adding time range */}
      {modalOpen && modalDay !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-xs">
            <h4 className="text-md font-semibold mb-2">{editRange && editRange.id ? 'Edit' : 'Add'} time range for {daysOfWeek[modalDay]}</h4>
            <form onSubmit={handleSaveRange}>
              <div className="mb-2">
                <label className="block text-xs font-medium text-gray-700">Start Time</label>
                <input type="time" value={editRange?.startTime || ''} onChange={e => setEditRange(r => r ? { ...r, startTime: e.target.value } : null)} className="w-full border rounded px-2 py-1" required />
              </div>
              <div className="mb-2">
                <label className="block text-xs font-medium text-gray-700">End Time</label>
                <input type="time" value={editRange?.endTime || ''} onChange={e => setEditRange(r => r ? { ...r, endTime: e.target.value } : null)} className="w-full border rounded px-2 py-1" required />
              </div>
              <div className="flex space-x-2 mt-2">
                <button type="submit" className="bg-blue-600 text-white px-4 py-1 rounded">Save</button>
                <button type="button" onClick={() => { setModalOpen(false); setEditRange(null); setModalDay(null); }} className="bg-gray-300 px-4 py-1 rounded">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TutorAvailabilityManager; 