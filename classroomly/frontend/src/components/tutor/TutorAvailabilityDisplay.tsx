import React, { useEffect, useState } from 'react';

const daysOfWeek = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
];

type Slot = {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  timezone: string;
};

interface TutorAvailabilityDisplayProps {
  tutorId: string;
}

const TutorAvailabilityDisplay: React.FC<TutorAvailabilityDisplayProps> = ({ tutorId }) => {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSlots = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/availability/${tutorId}`);
        const data = await res.json();
        setSlots(data.data || []);
      } catch (e) {
        setError('Failed to load availability.');
      } finally {
        setLoading(false);
      }
    };
    if (tutorId) fetchSlots();
  }, [tutorId]);

  return (
    <div className="max-w-lg mx-auto p-4 bg-white rounded shadow mt-6">
      <h3 className="text-lg font-semibold mb-2">Tutor Availability</h3>
      {loading ? (
        <div>Loading...</div>
      ) : error ? (
        <div className="text-red-600 text-sm">{error}</div>
      ) : slots.length === 0 ? (
        <div className="text-gray-500">No availability slots set.</div>
      ) : (
        <ul className="divide-y divide-gray-200">
          {slots.map(slot => (
            <li key={slot.id} className="flex items-center justify-between py-2">
              <span>
                <span className="font-medium">{daysOfWeek[slot.dayOfWeek]}</span>:
                {' '}{slot.startTime} - {slot.endTime} ({slot.timezone})
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default TutorAvailabilityDisplay; 