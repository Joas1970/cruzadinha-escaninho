create table if not exists curated_crossword (
  id text primary key,
  source text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists curated_crossword_updated_at_idx
  on curated_crossword (updated_at desc);
