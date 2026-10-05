create table if not exists generations (
  id         serial primary key,
  text       text not null,
  voice      text not null,
  format     text not null,
  size_bytes integer,
  url        text not null,
  created_at timestamptz not null default now()
);
