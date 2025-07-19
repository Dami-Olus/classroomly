-- Drop and recreate messages table with correct schema
DROP TABLE IF EXISTS messages;

CREATE TABLE messages (
  id uuid primary key default uuid_generate_v4(),
  sender_id uuid not null references users(id) on delete cascade,
  recipient_id uuid not null references users(id) on delete cascade,
  session_id uuid references sessions(id) on delete set null,
  content text not null,
  message_type varchar(20) not null default 'text' check (message_type in ('text', 'file', 'image', 'system')),
  file_url varchar(500),
  file_name varchar(255),
  file_size integer,
  is_read boolean default false,
  created_at timestamp with time zone default now()
);

-- Enable RLS if not already enabled
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to insert messages where they are the sender
CREATE POLICY "Allow insert for authenticated users" ON public.messages
  FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

-- Allow participants to select messages
CREATE POLICY "Allow select for participants" ON public.messages
  FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

-- Create materials table
create table if not exists materials (
  id uuid primary key default uuid_generate_v4(),
  class_id uuid references classes(id) on delete cascade,
  session_id uuid references sessions(id) on delete set null,
  uploader_id uuid references users(id) on delete cascade,
  uploader_type text check (uploader_type in ('TUTOR', 'STUDENT')),
  file_url text not null,
  file_name text not null,
  tag text check (tag in ('classwork', 'assignment', 'practice', 'test')),
  uploaded_at timestamp with time zone default now()
); 