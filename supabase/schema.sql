-- ============================================================
-- Mats & Roxy Rätsel-Adventskalender: Datenbank für die Web-App
-- Einmal komplett im Supabase SQL-Editor ausführen.
-- Das Skript kann gefahrlos erneut ausgeführt werden.
-- ============================================================

-- ---------- Tabellen ----------

-- Ein Profil pro angemeldeter Person
create table if not exists public.profiles (
    id            uuid primary key references auth.users (id) on delete cascade,
    email         text,
    display_name  text,
    approved      boolean not null default false,  -- erst nach Zahlung freischalten
    is_admin      boolean not null default false,
    created_at    timestamptz not null default now()
);

-- Rätsel und Geschichten
create table if not exists public.entries (
    id              uuid primary key default gen_random_uuid(),
    title           text not null,
    kind            text not null default 'raetsel' check (kind in ('raetsel', 'geschichte')),
    body            text not null default '',          -- Text aus dem Editor
    files           jsonb not null default '[]'::jsonb, -- hochgeladene Dateien (Canva-Exporte, Bilder)
    release_at      timestamptz not null,               -- ab wann sichtbar
    published       boolean not null default false,     -- Entwurf oder fertig
    is_final        boolean not null default false,     -- das Finalrätsel am 4. Advent
    reveal_result   boolean not null default false,     -- Teilnehmer sehen, ob ihre Antwort richtig war
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

-- Lösungen liegen getrennt und sind für Teilnehmer nie lesbar
create table if not exists public.solutions (
    entry_id  uuid primary key references public.entries (id) on delete cascade,
    answers   text[] not null default '{}'   -- mehrere erlaubte Schreibweisen
);

-- Abgaben: genau eine pro Person und Rätsel, Zeitstempel vom Server
create table if not exists public.submissions (
    id          uuid primary key default gen_random_uuid(),
    entry_id    uuid not null references public.entries (id) on delete cascade,
    user_id     uuid not null references public.profiles (id) on delete cascade,
    answer      text not null,
    is_correct  boolean not null default false,
    created_at  timestamptz not null default clock_timestamp(),
    unique (entry_id, user_id)
);

create index if not exists submissions_entry_idx on public.submissions (entry_id, created_at);

-- ---------- Hilfsfunktionen ----------

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
    select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.is_approved()
returns boolean language sql stable security definer set search_path = public as $$
    select coalesce((select approved or is_admin from public.profiles where id = auth.uid()), false);
$$;

-- Antworten vergleichbar machen: Groß/klein, Leerzeichen und Satzzeichen egal
create or replace function public.normalize_answer(t text)
returns text language sql immutable as $$
    select regexp_replace(lower(coalesce(t, '')), '[^a-z0-9äöüß]', '', 'g');
$$;

create or replace function public.is_released(e public.entries)
returns boolean language sql stable as $$
    select e.published and e.release_at <= now();
$$;

-- Profil automatisch anlegen, wenn sich jemand das erste Mal anmeldet
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
    insert into public.profiles (id, email)
    values (new.id, new.email)
    on conflict (id) do nothing;
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

drop trigger if exists entries_touch on public.entries;
create trigger entries_touch before update on public.entries
    for each row execute function public.touch_updated_at();

-- Richtig/falsch neu berechnen, wenn der Admin die Lösungen ändert
create or replace function public.recheck_submissions()
returns trigger language plpgsql security definer set search_path = public as $$
begin
    update public.submissions s
       set is_correct = public.normalize_answer(s.answer) in (
               select public.normalize_answer(a) from unnest(new.answers) a)
     where s.entry_id = new.entry_id;
    return new;
end;
$$;

drop trigger if exists solutions_recheck on public.solutions;
create trigger solutions_recheck after insert or update on public.solutions
    for each row execute function public.recheck_submissions();

-- ---------- Zugriffsregeln (Row Level Security) ----------

alter table public.profiles    enable row level security;
alter table public.entries     enable row level security;
alter table public.solutions   enable row level security;
alter table public.submissions enable row level security;

drop policy if exists "profil lesen" on public.profiles;
create policy "profil lesen" on public.profiles
    for select using (id = auth.uid() or public.is_admin());

drop policy if exists "admin ändert profile" on public.profiles;
create policy "admin ändert profile" on public.profiles
    for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin löscht profile" on public.profiles;
create policy "admin löscht profile" on public.profiles
    for delete using (public.is_admin());

drop policy if exists "freigegebene rätsel lesen" on public.entries;
create policy "freigegebene rätsel lesen" on public.entries
    for select using ((public.is_approved() and published and release_at <= now()) or public.is_admin());

drop policy if exists "admin verwaltet rätsel" on public.entries;
create policy "admin verwaltet rätsel" on public.entries
    for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin verwaltet lösungen" on public.solutions;
create policy "admin verwaltet lösungen" on public.solutions
    for all using (public.is_admin()) with check (public.is_admin());

-- Teilnehmer lesen ihre Abgaben nur über my_submissions(), damit "richtig/falsch" verborgen bleibt
drop policy if exists "admin liest abgaben" on public.submissions;
create policy "admin liest abgaben" on public.submissions
    for select using (public.is_admin());

drop policy if exists "admin ändert abgaben" on public.submissions;
create policy "admin ändert abgaben" on public.submissions
    for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin löscht abgaben" on public.submissions;
create policy "admin löscht abgaben" on public.submissions
    for delete using (public.is_admin());

-- ---------- Funktionen für die Teilnehmer ----------

-- Eigenen Anzeigenamen setzen (Teilnehmer dürfen sonst nichts am Profil ändern)
create or replace function public.set_display_name(new_name text)
returns void language plpgsql security definer set search_path = public as $$
begin
    if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
    update public.profiles
       set display_name = left(trim(new_name), 60)
     where id = auth.uid();
end;
$$;

-- Antwort abgeben: zählt nur einmal, Zeit kommt vom Server
create or replace function public.submit_answer(p_entry_id uuid, p_answer text)
returns table (submitted_at timestamptz, is_correct boolean)
language plpgsql security definer set search_path = public as $$
declare
    e public.entries;
    ok boolean;
    ts timestamptz;
begin
    if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
    if not public.is_approved() then raise exception 'Dein Zugang ist noch nicht freigeschaltet'; end if;
    if length(trim(coalesce(p_answer, ''))) = 0 then raise exception 'Bitte gib eine Antwort ein'; end if;

    select * into e from public.entries where id = p_entry_id;
    if not found or not public.is_released(e) then raise exception 'Dieses Rätsel ist noch nicht freigeschaltet'; end if;
    if e.kind <> 'raetsel' then raise exception 'Hier gibt es nichts abzugeben'; end if;

    if exists (select 1 from public.submissions s where s.entry_id = p_entry_id and s.user_id = auth.uid()) then
        raise exception 'Du hast für dieses Rätsel schon eine Antwort abgegeben';
    end if;

    select public.normalize_answer(p_answer) in (
               select public.normalize_answer(a) from unnest(sol.answers) a)
      into ok
      from public.solutions sol where sol.entry_id = p_entry_id;

    insert into public.submissions (entry_id, user_id, answer, is_correct)
    values (p_entry_id, auth.uid(), left(trim(p_answer), 500), coalesce(ok, false))
    returning created_at into ts;

    submitted_at := ts;
    is_correct := case when e.reveal_result then coalesce(ok, false) else null end;
    return next;
end;
$$;

-- Eigene Abgaben; "richtig/falsch" nur, wenn der Admin es für das Rätsel freigibt
create or replace function public.my_submissions()
returns table (entry_id uuid, answer text, submitted_at timestamptz, is_correct boolean)
language sql stable security definer set search_path = public as $$
    select s.entry_id, s.answer, s.created_at,
           case when e.reveal_result then s.is_correct else null end
      from public.submissions s
      join public.entries e on e.id = s.entry_id
     where s.user_id = auth.uid();
$$;

-- Wann kommt das nächste Rätsel? (nur die Zeit, kein Inhalt)
create or replace function public.next_release()
returns timestamptz language sql stable security definer set search_path = public as $$
    select min(release_at) from public.entries where published and release_at > now();
$$;

-- ---------- Rangliste (nur Admin) ----------
-- Regel aus den FAQ: Wer das Finalrätsel zuerst richtig löst und alle vorherigen Rätsel
-- gelöst hat, gewinnt. Danach zählt die Zahl der richtig gelösten Rätsel.
create or replace function public.admin_ranking()
returns table (
    user_id uuid, display_name text, email text,
    correct_count int, required_count int, all_previous_solved boolean,
    final_solved_at timestamptz
)
language plpgsql stable security definer set search_path = public as $$
begin
    if not public.is_admin() then raise exception 'Nur für Admins'; end if;
    return query
    with req as (
        select count(*)::int n from public.entries
         where kind = 'raetsel' and not is_final and published and release_at <= now()
    ), stats as (
        select p.id, p.display_name, p.email,
               count(*) filter (where s.is_correct)::int as correct,
               count(*) filter (where s.is_correct and not e.is_final)::int as correct_prev,
               min(s.created_at) filter (where s.is_correct and e.is_final) as final_at
          from public.profiles p
          left join public.submissions s on s.user_id = p.id
          left join public.entries e on e.id = s.entry_id
         where p.approved and not p.is_admin
         group by p.id
    )
    select st.id, st.display_name, st.email, st.correct, req.n,
           st.correct_prev >= req.n, st.final_at
      from stats st, req
     order by (st.final_at is not null and st.correct_prev >= req.n) desc,
              st.final_at asc nulls last,
              st.correct desc,
              st.display_name;
end;
$$;

-- ---------- Rechte ----------
revoke all on function public.admin_ranking() from anon;
revoke all on function public.submit_answer(uuid, text) from anon;
revoke all on function public.set_display_name(text) from anon;
revoke all on function public.my_submissions() from anon;

-- ---------- Speicher für Rätsel-Dateien ----------
-- Privater Bucket: Dateien liegen unter <rätsel-id>/<dateiname>
insert into storage.buckets (id, name, public)
values ('raetsel', 'raetsel', false)
on conflict (id) do nothing;

drop policy if exists "rätseldateien lesen" on storage.objects;
create policy "rätseldateien lesen" on storage.objects
    for select using (
        bucket_id = 'raetsel' and (
            public.is_admin() or (
                public.is_approved() and exists (
                    select 1 from public.entries e
                     where e.id::text = (storage.foldername(name))[1]
                       and e.published and e.release_at <= now()
                )
            )
        )
    );

drop policy if exists "admin lädt hoch" on storage.objects;
create policy "admin lädt hoch" on storage.objects
    for insert with check (bucket_id = 'raetsel' and public.is_admin());

drop policy if exists "admin ändert dateien" on storage.objects;
create policy "admin ändert dateien" on storage.objects
    for update using (bucket_id = 'raetsel' and public.is_admin());

drop policy if exists "admin löscht dateien" on storage.objects;
create policy "admin löscht dateien" on storage.objects
    for delete using (bucket_id = 'raetsel' and public.is_admin());

-- ---------- Ersten Admin festlegen ----------
-- Nach dem ersten Login mit deiner E-Mail-Adresse einmal ausführen
-- (E-Mail anpassen):
-- update public.profiles set is_admin = true, approved = true where email = 'deine@email.de';
