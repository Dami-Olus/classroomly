import React, { useState, useEffect } from 'react';

interface BookingModalProps {
  open: boolean;
  onClose: () => void;
  date: Date;
  classId: string;
  availableTimes: { start: Date; slot: any }[];
  selectedStartTime: { start: Date; slot: any } | null;
  setSelectedStartTime: (t: { start: Date; slot: any } | null) => void;
  onBooked?: () => void;
}

const BookingModal: React.FC<BookingModalProps> = ({ open, onClose, date, classId, availableTimes, selectedStartTime, setSelectedStartTime, onBooked }) => {
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        if (onBooked) onBooked();
        onClose();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [success, onBooked, onClose]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStartTime) {
      setError('Please select a start time.');
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(false);
    try {
      const token = localStorage.getItem('authToken');
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          classId,
          scheduledAt: selectedStartTime.start.toISOString(),
          notes
        })
      });
      if (!res.ok) {
        const err = await res.json();
        setError(err.message || 'Failed to book session.');
        setLoading(false);
        return;
      }
      setSuccess(true);
      setLoading(false);
      setNotes('');
      if (onBooked) onBooked();
    } catch (e) {
      setError('Failed to book session.');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-gray-500 hover:text-gray-700"
          aria-label="Close booking modal"
        >
          &times;
        </button>
        <h2 className="text-xl font-bold mb-2">Confirm Booking</h2>
        <div className="mb-4 text-gray-700">
          <div><span className="font-medium">Date:</span> {date.toLocaleDateString()}</div>
        </div>
        {success ? (
          <div className="flex flex-col items-center space-y-2 py-8">
            <div className="text-green-600 text-4xl">✓</div>
            <div className="text-green-700 font-semibold text-lg">Booking successful!</div>
            <div className="text-gray-500 text-sm">You will be redirected or the calendar will refresh shortly.</div>
          </div>
        ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block font-medium mb-1">Select a Time</label>
            <div className="flex flex-wrap gap-2">
              {availableTimes.length === 0 ? (
                <span className="text-gray-500">No available times for this day.</span>
              ) : (
                availableTimes.map((t) => (
                  <button
                    key={t.start.toISOString()}
                    type="button"
                    className={`px-3 py-1 rounded ${selectedStartTime === t ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
                    onClick={() => setSelectedStartTime(t)}
                    disabled={success}
                  >
                    {t.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {t.slot.endTime}
                  </button>
                ))
              )}
            </div>
          </div>
          <div>
            <label htmlFor="notes" className="block font-medium mb-1">Notes (optional)</label>
            <textarea
              id="notes"
              className="w-full border rounded px-3 py-2"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              disabled={success}
            />
          </div>
          {error && <div className="text-red-600 text-sm">{error}</div>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300"
              disabled={success}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              disabled={loading || !selectedStartTime || success}
            >
              {loading ? 'Booking...' : 'Book Session'}
            </button>
          </div>
        </form>
        )}
      </div>
    </div>
  );
};

export default BookingModal; 