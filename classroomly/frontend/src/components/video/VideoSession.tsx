"use client";
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';

interface VideoSessionProps {
  sessionId: string;
  userId: string;
  userType: 'TUTOR' | 'STUDENT';
  onSessionEnd?: () => void;
}

const SIGNAL_CHANNEL_PREFIX = 'video-signal-';

export default function VideoSession({ sessionId, userId, userType, onSessionEnd }: VideoSessionProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [showEndWarning, setShowEndWarning] = useState(false);
  const [sessionTime, setSessionTime] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Refs
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const sessionTimerRef = useRef<NodeJS.Timeout | null>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidate[]>([]);

  // Draggable bubble state
  const [dragging, setDragging] = useState(false);
  const [bubblePos, setBubblePos] = useState({ x: 20, y: 20 });

  // Initialize session
  useEffect(() => {
    initializeSession();
    return () => cleanupSession();
  }, []);

  // Session timer
  useEffect(() => {
    sessionTimerRef.current = setInterval(() => {
      setSessionTime(prev => prev + 1);
    }, 1000);

    return () => {
      if (sessionTimerRef.current) {
        clearInterval(sessionTimerRef.current);
      }
    };
  }, []);

  // Draggable bubble
  useEffect(() => {
    if (dragging) {
      const onMouseMove = (e: MouseEvent) => {
        if (bubbleRef.current) {
          const rect = bubbleRef.current.getBoundingClientRect();
          const x = e.clientX - rect.width / 2;
          const y = e.clientY - rect.height / 2;
          setBubblePos({ x: Math.max(0, x), y: Math.max(0, y) });
        }
      };

      const onMouseUp = () => setDragging(false);

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);

      return () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };
    }
  }, [dragging]);

  const onDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setDragging(true);
  };

  const onDrag = (e: MouseEvent) => {
    if (dragging && bubbleRef.current) {
      const rect = bubbleRef.current.getBoundingClientRect();
      const x = e.clientX - rect.width / 2;
      const y = e.clientY - rect.height / 2;
      setBubblePos({ x: Math.max(0, x), y: Math.max(0, y) });
    }
  };

  const onDragEnd = () => setDragging(false);

  const initializeSession = async () => {
    try {
      setIsConnecting(true);
      setError(null);
      
      // Check if mediaDevices is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera and microphone access is not supported in this browser. Please use a modern browser like Chrome, Firefox, or Safari.');
      }
      
      // Check if we're on HTTPS (required for getUserMedia in production)
      if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
        throw new Error('Camera and microphone access requires HTTPS. Please use HTTPS or localhost for development.');
      }
      
      // Try to get user media with fallback options
      let stream;
      try {
        // First try with both video and audio
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });
      } catch (videoAudioError) {
        console.log('Video + audio failed, trying audio only:', videoAudioError);
        try {
          // Fallback to audio only
          stream = await navigator.mediaDevices.getUserMedia({
            video: false,
            audio: true
          });
          setError('Video access denied. Audio-only mode enabled.');
        } catch (audioError) {
          console.log('Audio only failed, trying video only:', audioError);
          try {
            // Fallback to video only
            stream = await navigator.mediaDevices.getUserMedia({
              video: true,
              audio: false
            });
            setError('Microphone access denied. Video-only mode enabled.');
          } catch (videoError) {
            // All options failed
            throw new Error('Camera and microphone access denied. Please check your browser permissions and ensure you have a camera and microphone connected.');
          }
        }
      }
      
      localStreamRef.current = stream;
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      
      // Initialize WebRTC peer connection
      const peerConnection = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      });
      
      peerConnectionRef.current = peerConnection;
      
      // Add local stream to peer connection
      stream.getTracks().forEach(track => {
        peerConnection.addTrack(track, stream);
      });
      
      // Handle incoming streams
      peerConnection.ontrack = (event) => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
      };
      
      // Handle connection state changes
      peerConnection.onconnectionstatechange = () => {
        if (peerConnection.connectionState === 'connected') {
          setIsConnected(true);
          setIsConnecting(false);
        } else if (peerConnection.connectionState === 'failed') {
          setError('Connection failed. Please try again.');
          setIsConnecting(false);
        }
      };
      
      // Initialize signaling (in a real app, this would use WebSocket)
      await initializeSignaling();
      
    } catch (err) {
      console.error('Error initializing session:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to access camera/microphone. Please check permissions.';
      setError(errorMessage);
      setIsConnecting(false);
    }
  };
  
  let signalChannel: any = null;

  const initializeSignaling = async () => {
    // Subscribe to a Supabase Realtime channel for this session
    signalChannel = supabase.channel(`${SIGNAL_CHANNEL_PREFIX}${sessionId}`);

    // Listen for signaling messages
    signalChannel.on('broadcast', { event: 'signal' }, async (payload: any) => {
      const { type, data } = payload.payload;
      const pc = peerConnectionRef.current;
      if (!pc) return;
      if (type === 'offer') {
        await pc.setRemoteDescription(new RTCSessionDescription(data));
        // Add any queued ICE candidates
        for (const candidate of pendingCandidatesRef.current) {
          try { await pc.addIceCandidate(candidate); } catch (e) { /* ignore */ }
        }
        pendingCandidatesRef.current = [];
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        signalChannel.send({ type: 'broadcast', event: 'signal', payload: { type: 'answer', data: answer } });
      } else if (type === 'answer') {
        await pc.setRemoteDescription(new RTCSessionDescription(data));
        // Add any queued ICE candidates
        for (const candidate of pendingCandidatesRef.current) {
          try { await pc.addIceCandidate(candidate); } catch (e) { /* ignore */ }
        }
        pendingCandidatesRef.current = [];
      } else if (type === 'ice') {
        const candidate = new RTCIceCandidate(data);
        if (pc.remoteDescription && pc.remoteDescription.type) {
          try { await pc.addIceCandidate(candidate); } catch (e) { /* ignore */ }
        } else {
          pendingCandidatesRef.current.push(candidate);
        }
      }
    });
    await signalChannel.subscribe();

    // Send offer/answer/ice
    const pc = peerConnectionRef.current;
    if (userType === 'TUTOR' && pc) {
      // Tutor initiates the call
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      signalChannel.send({ type: 'broadcast', event: 'signal', payload: { type: 'offer', data: offer } });
    }
    if (pc) {
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          signalChannel.send({ type: 'broadcast', event: 'signal', payload: { type: 'ice', data: event.candidate } });
        }
      };
    }
  };
  
  const cleanupSession = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }
    
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
    }
    
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }
    
    if (sessionTimerRef.current) {
      clearInterval(sessionTimerRef.current);
    }
  };
  
  // Audio/Video controls
  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  }, []);
  
  const toggleVideo = useCallback(() => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
      }
    }
  }, []);
  
  const toggleScreenShare = useCallback(async () => {
    try {
      if (!isScreenSharing) {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true
        });
        
        screenStreamRef.current = screenStream;
        
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream;
        }
        
        setIsScreenSharing(true);
      } else {
        if (screenStreamRef.current) {
          screenStreamRef.current.getTracks().forEach(track => track.stop());
        }
        
        if (localVideoRef.current && localStreamRef.current) {
          localVideoRef.current.srcObject = localStreamRef.current;
        }
        
        setIsScreenSharing(false);
      }
    } catch (err) {
      console.error('Error toggling screen share:', err);
    }
  }, [isScreenSharing]);
  
  // Session management
  const endSession = useCallback(() => {
    if (confirm('Are you sure you want to end this session?')) {
      setIsEnding(true);
      setShowEndWarning(false);
      
      // Show 30-second warning
      setTimeout(() => {
        cleanupSession();
        onSessionEnd?.();
      }, 30000);
    }
  }, [onSessionEnd]);
  
  const displayEndWarning = useCallback(() => {
    setShowEndWarning(true);
    setTimeout(() => setShowEndWarning(false), 5000);
  }, []);
  
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.code === 'Space' && e.target === document.body) {
        e.preventDefault();
        toggleMute();
      }
    };
    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [toggleMute]);
  
  // Format session time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
          <div className="text-center">
            <div className="text-red-500 text-6xl mb-4">⚠️</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Connection Error</h2>
            <p className="text-gray-600 mb-4">{error}</p>
            
            {/* Additional help text based on error type */}
            {error.includes('permission') || error.includes('denied') ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-4 text-left">
                <h3 className="font-semibold text-yellow-800 mb-2">How to fix:</h3>
                <ul className="text-sm text-yellow-700 space-y-1">
                  <li>• Click the camera/microphone icon in your browser's address bar</li>
                  <li>• Select "Allow" for camera and microphone access</li>
                  <li>• Refresh the page and try again</li>
                  <li>• Make sure your camera and microphone are connected and working</li>
                </ul>
              </div>
            ) : error.includes('HTTPS') ? (
              <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-4 text-left">
                <h3 className="font-semibold text-blue-800 mb-2">Development Note:</h3>
                <p className="text-sm text-blue-700">
                  Camera access requires HTTPS in production. For development, use localhost or 127.0.0.1.
                </p>
              </div>
            ) : null}
            
            <div className="flex space-x-3 justify-center">
              <button
                onClick={initializeSession}
                disabled={isConnecting}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {isConnecting ? 'Retrying...' : 'Retry Connection'}
              </button>
              <button
                onClick={() => window.location.reload()}
                className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700"
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Main Video Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-gray-800 text-white p-4 flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <h1 className="text-xl font-bold">Live Session</h1>
            <span className="text-sm text-gray-300">Session ID: {sessionId}</span>
            <span className="text-sm text-gray-300">Time: {formatTime(sessionTime)}</span>
          </div>
          
          <div className="flex items-center space-x-2">
            {isConnecting && (
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span className="text-sm">Connecting...</span>
              </div>
            )}
            
            {isConnected && (
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-sm text-green-400">Connected</span>
              </div>
            )}
          </div>
        </div>
        
        {/* Video Grid */}
        <div className="flex-1 flex">
          {/* Remote Video (Main) */}
          <div className="flex-1 relative bg-black">
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
            {!remoteVideoRef.current?.srcObject && (
              <div className="absolute inset-0 flex items-center justify-center text-white">
                <div className="text-center">
                  <div className="text-6xl mb-4">👤</div>
                  <p>Waiting for {userType === 'TUTOR' ? 'student' : 'tutor'} to join...</p>
                </div>
              </div>
            )}
          </div>
          
          {/* Local Video (Picture-in-Picture) */}
          <div
            ref={bubbleRef}
            className="z-50 shadow-lg border-2 border-white bg-black rounded-lg overflow-hidden"
            style={isScreenSharing
              ? { position: 'fixed', right: 24, bottom: 24, width: 192, height: 144 }
              : { position: 'absolute', left: bubblePos.x, top: bubblePos.y, width: 192, height: 144, cursor: 'move' }
            }
          >
            {/* Drag handle */}
            <div
              className="w-full h-6 bg-gray-800 bg-opacity-60 flex items-center justify-center cursor-move select-none"
              onMouseDown={onDragStart}
              style={{ zIndex: 2 }}
            >
              <span className="text-xs text-white">Drag</span>
            </div>
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-[calc(100%-1.5rem)] object-cover"
              style={{ borderRadius: 0 }}
            />
          </div>
        </div>
        
        {/* Controls */}
        <div className="bg-gray-800 p-4">
          <div className="flex justify-center items-center space-x-4">
            {/* Mute Button */}
            <button
              onClick={toggleMute}
              className={`p-3 rounded-full ${
                isMuted ? 'bg-red-600 text-white' : 'bg-gray-600 text-white hover:bg-gray-700'
              }`}
              title="Toggle Mute (Spacebar)"
            >
              {isMuted ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              )}
            </button>
            
            {/* Video Button */}
            <button
              onClick={toggleVideo}
              className={`p-3 rounded-full ${
                isVideoOff ? 'bg-red-600 text-white' : 'bg-gray-600 text-white hover:bg-gray-700'
              }`}
            >
              {isVideoOff ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18.364 5.636M5.636 18.364l12.728-12.728" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              )}
            </button>
            
            {/* Screen Share Button */}
            <button
              onClick={toggleScreenShare}
              className={`p-3 rounded-full ${
                isScreenSharing ? 'bg-blue-600 text-white' : 'bg-gray-600 text-white hover:bg-gray-700'
              }`}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </button>
            
            {/* End Session Button */}
            <button
              onClick={endSession}
              disabled={isEnding}
              className="p-3 rounded-full bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
      
      {/* End Session Warning */}
      {showEndWarning && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full mx-4">
            <div className="text-center">
              <div className="text-yellow-500 text-6xl mb-4">⚠️</div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Session Ending Soon</h2>
              <p className="text-gray-600 mb-4">
                This session will end in 30 seconds. Please wrap up your discussion.
              </p>
              <button
                onClick={() => setShowEndWarning(false)}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 