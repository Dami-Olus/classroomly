-- Messages table migration with RLS policies
-- Run this in your Supabase SQL Editor

-- Drop existing table if it exists
DROP TABLE IF EXISTS public.messages CASCADE;

-- Create messages table with correct schema
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  message_type VARCHAR(20) NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', file, 'image', system')),
  file_url VARCHAR(500),
  file_name VARCHAR(255),
  file_size INTEGER,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_messages_sender_id ON messages(sender_id);
CREATE INDEX idx_messages_recipient_id ON messages(recipient_id);
CREATE INDEX idx_messages_session_id ON messages(session_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);

-- Enable Row Level Security
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- RLS Policy 1: Users can insert messages where they are the sender
CREATE POLICY "Users can insert their own messages" ON public.messages
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- RLS Policy2 can view messages where they are sender or recipient
CREATE POLICY "Users can view messages they sent or received" ON public.messages
  FOR SELECT USING (
    auth.uid() = sender_id OR 
    auth.uid() = recipient_id OR
    -- Allow viewing session messages if user is part of the session
    (session_id IS NOT NULL AND EXISTS (
      SELECT1 FROM sessions s 
      WHERE s.id = messages.session_id 
      AND (s.tutor_id = auth.uid() OR s.student_id = auth.uid())
    ))
  );

-- RLS Policy 3: Users can update their own messages (for marking as read, etc.)
CREATE POLICY "Users can update their own messages" ON public.messages
  FOR UPDATE USING (auth.uid() = sender_id);

-- RLS Policy 4: Users can delete their own messages
CREATE POLICY "Users can delete their own messages" ON public.messages
  FOR DELETE USING (auth.uid() = sender_id);

-- Grant necessary permissions to authenticated users
GRANT ALL ON public.messages TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

-- Add comments for documentation
COMMENT ON TABLE public.messages IS 'Chat messages between users during or outside sessions';
COMMENT ON COLUMN public.messages.sender_id IS 'ID of the user who sent the message';
COMMENT ON COLUMN public.messages.recipient_id IS 'ID of the user who should receive the message';
COMMENT ON COLUMN public.messages.session_id IS 'ID of the session this message belongs to (nullable for DMs)';
COMMENT ON COLUMN public.messages.content IS 'The message content';
COMMENT ON COLUMN public.messages.message_type IS 'Type of message: text, file, image, or system';
COMMENT ON COLUMN public.messages.file_url IS 'URL to uploaded file (for file messages)';
COMMENT ON COLUMN public.messages.file_name IS 'Original filename (for file messages)';
COMMENT ON COLUMN public.messages.file_size IS 'File size in bytes (for file messages)';
COMMENT ON COLUMN public.messages.is_read IS 'Whether the message has been read by recipient';
COMMENT ON COLUMN public.messages.created_at IS 'Timestamp when message was created'; 