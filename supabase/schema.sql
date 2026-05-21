create extension if not exists vector;

create table if not exists canon_documents (
  id bigserial primary key,
  path text not null unique,
  title text not null,
  content text not null,
  headings text[] not null default '{}',
  embedding vector(1536),
  updated_at timestamptz not null default now()
);

create index if not exists canon_documents_embedding_idx
on canon_documents using ivfflat (embedding vector_cosine_ops)
with (lists = 100);

create or replace function match_canon_documents(
  query_embedding vector(1536),
  match_count int default 10
)
returns table (
  path text,
  title text,
  content text,
  similarity float
)
language sql stable
as $$
  select
    path,
    title,
    content,
    1 - (embedding <=> query_embedding) as similarity
  from canon_documents
  where embedding is not null
  order by embedding <=> query_embedding
  limit match_count;
$$;
