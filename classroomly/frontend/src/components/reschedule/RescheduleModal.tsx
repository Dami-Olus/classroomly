import React from 'react';
import { Dialog, DialogPanel, DialogTitle, DialogBackdrop } from '@headlessui/react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';

interface SlotOption {
  value: string; // ISO string
  label: string; // Human readable
}

interface RescheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { proposedTime: string }) => Promise<void>;
  availableDates: Date[];
  slotsForDate: SlotOption[];
  onDateChange: (date: Date) => void;
  loadingSlots?: boolean;
  error?: string | null;
}

const RescheduleModal: React.FC<RescheduleModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  availableDates,
  slotsForDate,
  onDateChange,
  loadingSlots = false,
  error = null,
}) => {
  const [selectedSlot, setSelectedSlot] = React.useState<string>('');
  const [selectedDate, setSelectedDate] = React.useState<Date | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      setSelectedSlot('');
      setSubmitError(null);
      setSelectedDate(null);
    }
  }, [isOpen]);

  const handleDateChange = (date: Date) => {
    setSelectedDate(date);
    setSelectedSlot('');
    onDateChange(date);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    if (!selectedSlot) {
      setSubmitError('Please select a slot');
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({ proposedTime: selectedSlot });
    } catch (err: any) {
      setSubmitError(err?.message || 'Failed to propose reschedule');
    } finally {
      setSubmitting(false);
    }
  };

  // Only allow selection of available dates
  const tileDisabled = ({ date }: { date: Date }) => {
    return !availableDates.some(d => d.toDateString() === date.toDateString());
  };

  return (
    <Dialog open={isOpen} onClose={onClose} className="fixed z-50 inset-0 overflow-y-auto" aria-label="Propose new session time">
      <div className="flex items-center justify-center min-h-screen px-4">
        <DialogBackdrop className="fixed inset-0 bg-black opacity-30" />
        <DialogPanel className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-auto p-6 z-10">
          <DialogTitle className="text-lg font-semibold mb-2">Propose New Session Time</DialogTitle>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Select a date</label>
              <Calendar
                onChange={handleDateChange}
                value={selectedDate}
                tileDisabled={tileDisabled}
                minDate={new Date()}
                maxDate={availableDates.length ? availableDates[availableDates.length - 1] : undefined}
              />
            </div>
            {selectedDate && (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Select an available slot</label>
                {loadingSlots ? (
                  <div className="text-gray-400 text-center py-4">Loading available slots...</div>
                ) : slotsForDate.length === 0 ? (
                  <div className="text-gray-500 text-center py-4">No available slots for this date.</div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {slotsForDate.map(slot => (
                      <button
                        type="button"
                        key={slot.value}
                        className={`px-3 py-1 rounded ${selectedSlot === slot.value ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
                        onClick={() => setSelectedSlot(slot.value)}
                        aria-pressed={selectedSlot === slot.value}
                      >
                        {slot.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {error && <div className="text-red-500 text-sm">{error}</div>}
            {submitError && <div className="text-red-500 text-sm">{submitError}</div>}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="px-4 py-2 rounded bg-gray-200 text-gray-700 hover:bg-gray-300"
                onClick={onClose}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                disabled={submitting || loadingSlots || !selectedSlot}
              >
                {submitting ? 'Submitting...' : 'Submit'}
              </button>
            </div>
          </form>
        </DialogPanel>
      </div>
    </Dialog>
  );
};

export default React.memo(RescheduleModal); 