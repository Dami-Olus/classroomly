import React from 'react';

export interface RescheduleRequest {
  id: string;
  proposedTime: string;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'CANCELLED';
  requestedBy: {
    id: string;
    firstName: string;
    lastName: string;
    userType: 'TUTOR' | 'STUDENT';
  };
  createdAt: string;
}

interface RescheduleRequestsListProps {
  requests: RescheduleRequest[];
  currentUserId: string;
  onAccept: (requestId: string) => Promise<void>;
  onDecline: (requestId: string) => Promise<void>;
  loadingId?: string | null;
  error?: string | null;
}

const RescheduleRequestsList: React.FC<RescheduleRequestsListProps> = ({
  requests,
  currentUserId,
  onAccept,
  onDecline,
  loadingId,
  error,
}) => {
  if (!requests.length) {
    return <div className="text-gray-500 text-sm">No reschedule requests yet.</div>;
  }

  return (
    <div className="space-y-4 mt-4">
      {requests.map((req) => {
        const isRecipient = req.requestedBy.id !== currentUserId && req.status === 'PENDING';
        return (
          <div key={req.id} className="border rounded p-4 bg-gray-50 flex flex-col md:flex-row md:items-center md:justify-between">
            <div>
              <div className="font-medium">
                Proposed by {req.requestedBy.firstName} {req.requestedBy.lastName} ({req.requestedBy.userType})
              </div>
              <div className="text-sm text-gray-700 mt-1">
                New Time: <span className="font-semibold">{new Date(req.proposedTime).toLocaleString()}</span>
              </div>
              <div className="text-xs text-gray-400 mt-1">Requested at {new Date(req.createdAt).toLocaleString()}</div>
              <div className="mt-1">
                <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                  req.status === 'PENDING'
                    ? 'bg-yellow-100 text-yellow-800'
                    : req.status === 'ACCEPTED'
                    ? 'bg-green-100 text-green-800'
                    : req.status === 'DECLINED'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-gray-200 text-gray-600'
                }`}>
                  {req.status}
                </span>
              </div>
            </div>
            {isRecipient && (
              <div className="flex gap-2 mt-2 md:mt-0">
                <button
                  className="px-3 py-1 rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                  onClick={() => onAccept(req.id)}
                  disabled={loadingId === req.id}
                  aria-label="Accept reschedule request"
                >
                  {loadingId === req.id ? 'Accepting...' : 'Accept'}
                </button>
                <button
                  className="px-3 py-1 rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                  onClick={() => onDecline(req.id)}
                  disabled={loadingId === req.id}
                  aria-label="Decline reschedule request"
                >
                  {loadingId === req.id ? 'Declining...' : 'Decline'}
                </button>
              </div>
            )}
          </div>
        );
      })}
      {error && <div className="text-red-500 text-sm mt-2">{error}</div>}
    </div>
  );
};

export default React.memo(RescheduleRequestsList); 