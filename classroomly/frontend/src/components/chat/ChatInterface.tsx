"use client";
import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../../lib/supabaseClient";
import toast from "react-hot-toast";

interface ChatMessage {
  id: string;
  sender_id: string;
  sender_name?: string;
  content: string;
  message_type: "text" | "file" | "image" | "system";
  file_url?: string;
  file_name?: string;
  file_size?: number;
  created_at: string;
  is_read: boolean;
}

interface ChatInterfaceProps {
  sessionId?: string;
  recipientId?: string;
  currentUserId: string;
  currentUserName: string;
  recipientName?: string;
  isVideoSession?: boolean;
  className?: string;
}

const ALLOWED_FILE_TYPES = [
  "image/jpeg", "image/png", "image/gif", "image/webp",
  "application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export default function ChatInterface({
  sessionId,
  recipientId,
  currentUserId,
  currentUserName,
  recipientName,
  isVideoSession = false,
  className = ""
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // Subscribe to real-time messages
  useEffect(() => {
    let channel: any = null;
    if (sessionId) {
      channel = supabase
        .channel(`chat-session-${sessionId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter: `session_id=eq.${sessionId}`
          },
          (payload) => {
            const newMsg = payload.new as ChatMessage;
            setMessages((prev) => [...prev, newMsg]);
            if (newMsg.sender_id !== currentUserId) {
              markMessageAsRead(newMsg.id);
              setUnreadCount((prev) => prev + 1);
            }
          }
        )
        .subscribe();
    } else if (recipientId) {
      channel = supabase
        .channel(`chat-dm-${currentUserId}-${recipientId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter: `(sender_id=eq.${currentUserId} AND recipient_id=eq.${recipientId}) OR (sender_id=eq.${recipientId} AND recipient_id=eq.${currentUserId})`
          },
          (payload) => {
            const newMsg = payload.new as ChatMessage;
            setMessages((prev) => [...prev, newMsg]);
            if (newMsg.sender_id !== currentUserId) {
              markMessageAsRead(newMsg.id);
              setUnreadCount((prev) => prev + 1);
            }
          }
        )
        .subscribe();
    }
    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [sessionId, recipientId, currentUserId]);

  // Load initial messages
  useEffect(() => {
    loadMessages();
    // eslint-disable-next-line
  }, [sessionId, recipientId]);

  const loadMessages = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from("messages")
        .select("*")
        .order("created_at", { ascending: true });
      if (sessionId) {
        query = query.eq("session_id", sessionId);
      } else if (recipientId) {
        query = query.or(
          `and(sender_id.eq.${currentUserId},recipient_id.eq.${recipientId}),and(sender_id.eq.${recipientId},recipient_id.eq.${currentUserId})`
        );
      }
      const { data, error } = await query;
      if (error) {
        toast.error("Failed to load messages");
        return;
      }
      setMessages(data || []);
    } catch (error) {
      toast.error("Failed to load messages");
    } finally {
      setIsLoading(false);
    }
  };

  const markMessageAsRead = async (messageId: string) => {
    try {
      await supabase.from("messages").update({ is_read: true }).eq("id", messageId);
    } catch (error) {
      // Silent fail
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    try {
      const messageData: any = {
        sender_id: currentUserId,
        content: newMessage.trim(),
        message_type: "text",
        is_read: false
      };
      if (sessionId) {
        messageData.session_id = sessionId;
      }
      if (recipientId) {
        messageData.recipient_id = recipientId;
      }
      const { error } = await supabase.from("messages").insert([messageData]);
      if (error) {
        toast.error("Failed to send message");
        return;
      }
      setNewMessage("");
    } catch (error) {
      toast.error("Failed to send message");
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
      toast.error("File size must be less than 10MB");
      return;
    }
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      toast.error("File type not supported");
      return;
    }
    try {
      setIsUploading(true);
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `chat-files/${sessionId || recipientId}/${fileName}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("chat-files")
        .upload(filePath, file);
      if (uploadError) {
        toast.error("Failed to upload file");
        return;
      }
      const { data: urlData } = supabase.storage.from("chat-files").getPublicUrl(filePath);
      const messageData: any = {
        sender_id: currentUserId,
        content: `Sent a file: ${file.name}`,
        message_type: "file",
        file_url: urlData.publicUrl,
        file_name: file.name,
        file_size: file.size,
        is_read: false
      };
      if (sessionId) {
        messageData.session_id = sessionId;
      }
      if (recipientId) {
        messageData.recipient_id = recipientId;
      }
      const { error: messageError } = await supabase.from("messages").insert([messageData]);
      if (messageError) {
        toast.error("Failed to send file");
        return;
      }
      toast.success("File sent successfully");
    } catch (error) {
      toast.error("Failed to upload file");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  return (
    <div className={`flex flex-col h-full bg-white border border-gray-200 rounded-lg ${className}`}>
      {/* Chat Header */}
      <div className="p-4 border-b border-gray-200 bg-gray-50 rounded-t-lg flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">
          {isVideoSession ? "Session Chat" : recipientName || "Chat"}
        </h3>
        {unreadCount > 0 && (
          <span className="ml-2 bg-blue-600 text-white text-xs px-2 py-1 rounded-full">
            {unreadCount}
          </span>
        )}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
          title="Attach file"
        >
          {isUploading ? (
            <div className="w-5 h-5 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 002.828 2.828l6.415-6.415a4 4 0 00-5.656-5.656l-6.415 6.415a6 6 0 008.486 8.486" />
            </svg>
          )}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileUpload}
          className="hidden"
          accept="image/*,.pdf,.doc,.docx,.txt,.xls,.xlsx"
        />
      </div>
      {/* Messages */}
      <div
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-3"
      >
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4-4.03 8-9 8s-9-4-9-8a9 9 0 0117.995-1.385L21 12z" />
            </svg>
            <p>No messages yet. Start the conversation!</p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.sender_id === currentUserId ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-xs px-3 py-2 rounded-lg ${
                  message.sender_id === currentUserId
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-900"
                }`}
              >
                {message.sender_id !== currentUserId && (
                  <div className="text-xs opacity-75 mb-1">{message.sender_name || "User"}</div>
                )}
                {message.message_type === "file" ? (
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 002.828 2.828l6.415-6.415a4 4 0 00-5.656-5.656l-6.415 6.415a6 6 0 008.486 8.486" />
                      </svg>
                      <span className="text-sm font-medium">{message.file_name}</span>
                    </div>
                    <div className="text-xs opacity-75">
                      {message.file_size && formatFileSize(message.file_size)}
                    </div>
                    <a
                      href={message.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block text-xs underline hover:no-underline"
                    >
                      Download
                    </a>
                  </div>
                ) : (
                  <div>{message.content}</div>
                )}
                <div className="text-xs opacity-75 mt-1">
                  {formatTime(message.created_at)}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      {/* Message Input */}
      <div className="p-4 border-t border-gray-200">
        <form onSubmit={sendMessage} className="flex space-x-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isUploading}
            aria-label="Type a message"
          />
          <button
            type="submit"
            disabled={!newMessage.trim() || isUploading}
            className="px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
} 