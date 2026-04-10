-- Criterion Feedback Table
-- Run this in the Supabase SQL editor to enable per-criterion thumbs up/down feedback (G15).
--
-- After running, the thumbs buttons in the criteria breakdown panel will
-- persist feedback across sessions. Without this migration the buttons
-- still appear but silently no-op (no errors in the UI).

create table if not exists criterion_feedback (
  id            uuid primary key default gen_random_uuid(),
  candidate_id  uuid not null references candidates(id) on delete cascade,
  criterion_name text not null,
  project_id    uuid not null references projects(id) on delete cascade,
  direction     text not null check (direction in ('up', 'down')),
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),
  -- One feedback entry per candidate+criterion (upsert toggles direction)
  unique(candidate_id, criterion_name)
);

-- Index for the fetchCriterionFeedback query (filter by project_id)
create index if not exists criterion_feedback_project_idx
  on criterion_feedback(project_id);

-- Enable Row Level Security
alter table criterion_feedback enable row level security;

-- Users can only see and write their own project's feedback
create policy "Users manage own criterion feedback"
  on criterion_feedback
  for all
  using (
    project_id in (
      select id from projects where user_id = auth.uid()
    )
  );
