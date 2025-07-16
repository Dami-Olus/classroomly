-- Create messages table
create table if not exists messages (
  id uuid primary key default uuid_generate_v4(),
  class_id uuid references classes(id) on delete cascade,
  session_id uuid references sessions(id) on delete set null,
  sender_id uuid references users(id) on delete cascade,
  sender_type text check (sender_type in ('TUTOR', 'STUDENT')),
  message text not null,
  created_at timestamp with time zone default now()
);

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