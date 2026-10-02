-- ============================================================================
-- GEMS — Espace club (clubs, membres, groupes, séances collectives, réservations)
-- ----------------------------------------------------------------------------
-- Modèle :
--   clubs            1 club = 1 abonnement « GEMS Club » (nb de licences)
--   club_groups      groupes d'entraînement (Compétition, Découverte…)
--   club_members     qui est dans le club + ses rôles cumulables
--                    (admin / coach / athlete / bureau / benevole / parent),
--                    son groupe, son coach référent, son adhésion.
--                    user_id NULL = invitation envoyée à invite_email, pas encore acceptée.
--   club_sessions    séances du club : cours collectifs ET créneaux 1:1
--   club_bookings    réservations / liste d'attente / présence
--
-- Les FK pointent vers profiles (pas auth.users) pour que PostgREST puisse embarquer
-- nom/photo : select('*, profile:user_id(full_name, photo_url)').
-- Le coach référent est aussi écrit dans coach_athletes (relation existante) pour
-- que plans, messages et fiche athlète du portail + de l'app continuent de marcher.
--
-- À exécuter dans Supabase → SQL Editor. Additif et idempotent (rejouable).
-- Dépend de db/coach_waitlist_access.sql (fonction is_coach()).
-- ============================================================================

-- ── Tables ──────────────────────────────────────────────────────────────────
create table if not exists public.clubs (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  city         text,
  logo_url     text,
  plan_tier    text not null default 'club_pro',
  seats        int  not null default 250,
  invite_code  text not null unique default upper(substr(md5(random()::text), 1, 6)),
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);

create table if not exists public.club_groups (
  id         uuid primary key default gen_random_uuid(),
  club_id    uuid not null references public.clubs(id) on delete cascade,
  name       text not null,
  color      text,
  created_at timestamptz not null default now()
);

create table if not exists public.club_members (
  id               uuid primary key default gen_random_uuid(),
  club_id          uuid not null references public.clubs(id) on delete cascade,
  user_id          uuid references public.profiles(id) on delete cascade,
  invite_email     text,
  roles            text[] not null default array['athlete'],
  group_id         uuid references public.club_groups(id) on delete set null,
  coach_id         uuid references public.profiles(id) on delete set null,
  status           text not null default 'active' check (status in ('active','invited','inactive')),
  membership_until date,
  license_number   text,
  joined_at        timestamptz not null default now(),
  constraint club_members_who check (user_id is not null or invite_email is not null)
);
create unique index if not exists club_members_club_user on public.club_members(club_id, user_id) where user_id is not null;
create unique index if not exists club_members_club_invite on public.club_members(club_id, lower(invite_email)) where user_id is null;
create index if not exists club_members_user on public.club_members(user_id);

create table if not exists public.club_sessions (
  id           uuid primary key default gen_random_uuid(),
  club_id      uuid not null references public.clubs(id) on delete cascade,
  coach_id     uuid references public.profiles(id) on delete set null,
  kind         text not null default 'collective' check (kind in ('collective','one_on_one')),
  sport        text not null default 'run',
  title        text not null,
  starts_at    timestamptz not null,
  duration_min int  not null default 60,
  location     text,
  capacity     int,
  group_id     uuid references public.club_groups(id) on delete set null,
  zone         text,
  tss          int,
  blocks       jsonb not null default '[]'::jsonb,
  description  text,
  created_at   timestamptz not null default now()
);
create index if not exists club_sessions_club_time on public.club_sessions(club_id, starts_at);

create table if not exists public.club_bookings (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.club_sessions(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  status     text not null default 'booked' check (status in ('booked','waitlist','cancelled')),
  attended   boolean,
  created_at timestamptz not null default now(),
  unique (session_id, user_id)
);
create index if not exists club_bookings_user on public.club_bookings(user_id);

-- ── Helpers (security definer : évitent la récursion RLS) ───────────────────
create or replace function public.club_role(p_club uuid, p_role text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.club_members
    where club_id = p_club and user_id = auth.uid() and status = 'active' and p_role = any(roles)
  );
$$;

create or replace function public.is_club_member(p_club uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.club_members
    where club_id = p_club and user_id = auth.uid() and status = 'active'
  );
$$;

-- Staff = admin ou coach du club.
create or replace function public.is_club_staff(p_club uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.club_role(p_club, 'admin') or public.club_role(p_club, 'coach');
$$;

-- L'utilisateur courant et p_user partagent-ils un club où le courant est staff ?
create or replace function public.is_staff_of_user(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.club_members me
    join public.club_members them on them.club_id = me.club_id
    where me.user_id = auth.uid() and me.status = 'active'
      and ('admin' = any(me.roles) or 'coach' = any(me.roles))
      and them.user_id = p_user
  );
$$;

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.clubs         enable row level security;
alter table public.club_groups   enable row level security;
alter table public.club_members  enable row level security;
alter table public.club_sessions enable row level security;
alter table public.club_bookings enable row level security;

-- clubs : les membres lisent, les admins modifient (création via create_club()).
drop policy if exists clubs_read on public.clubs;
create policy clubs_read on public.clubs for select using (public.is_club_member(id));
drop policy if exists clubs_admin_update on public.clubs;
create policy clubs_admin_update on public.clubs for update
  using (public.club_role(id, 'admin')) with check (public.club_role(id, 'admin'));

-- groupes : membres lisent, admins gèrent.
drop policy if exists groups_read on public.club_groups;
create policy groups_read on public.club_groups for select using (public.is_club_member(club_id));
drop policy if exists groups_admin_write on public.club_groups;
create policy groups_admin_write on public.club_groups for all
  using (public.club_role(club_id, 'admin')) with check (public.club_role(club_id, 'admin'));

-- membres : chacun voit sa ligne ; le staff voit tout le club ; admins gèrent.
drop policy if exists members_read on public.club_members;
create policy members_read on public.club_members for select
  using (user_id = auth.uid() or public.is_club_member(club_id));
drop policy if exists members_admin_write on public.club_members;
create policy members_admin_write on public.club_members for all
  using (public.club_role(club_id, 'admin')) with check (public.club_role(club_id, 'admin'));

-- séances : membres lisent, staff crée/modifie.
drop policy if exists sessions_read on public.club_sessions;
create policy sessions_read on public.club_sessions for select using (public.is_club_member(club_id));
drop policy if exists sessions_staff_write on public.club_sessions;
create policy sessions_staff_write on public.club_sessions for all
  using (public.is_club_staff(club_id)) with check (public.is_club_staff(club_id));

-- réservations : l'athlète gère les siennes ; le staff du club lit et pointe la présence.
drop policy if exists bookings_own on public.club_bookings;
drop policy if exists bookings_own_read on public.club_bookings;
create policy bookings_own_read on public.club_bookings for select using (user_id = auth.uid());
drop policy if exists bookings_own_insert on public.club_bookings;
create policy bookings_own_insert on public.club_bookings for insert with check (user_id = auth.uid());
drop policy if exists bookings_own_update on public.club_bookings;
create policy bookings_own_update on public.club_bookings for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
-- Annulation par l'athlète : jusqu'à 3h avant le début (liste d'attente : à tout moment).
drop policy if exists bookings_own_delete on public.club_bookings;
create policy bookings_own_delete on public.club_bookings for delete using (
  user_id = auth.uid() and (
    status = 'waitlist'
    or exists (select 1 from public.club_sessions s where s.id = session_id and s.starts_at > now() + interval '3 hours')
  )
);
drop policy if exists bookings_staff on public.club_bookings;
create policy bookings_staff on public.club_bookings for all
  using (exists (select 1 from public.club_sessions s where s.id = session_id and public.is_club_staff(s.club_id)))
  with check (exists (select 1 from public.club_sessions s where s.id = session_id and public.is_club_staff(s.club_id)));
-- Les membres voient les réservations des séances de leur club (compteur de places, avatars).
drop policy if exists bookings_club_read on public.club_bookings;
create policy bookings_club_read on public.club_bookings for select
  using (exists (select 1 from public.club_sessions s where s.id = session_id and public.is_club_member(s.club_id)));

-- profils : les membres d'un même club se voient (nom, photo) ; le staff aussi.
drop policy if exists profiles_club_read on public.profiles;
create policy profiles_club_read on public.profiles for select using (
  exists (
    select 1 from public.club_members me
    join public.club_members them on them.club_id = me.club_id
    where me.user_id = auth.uid() and me.status = 'active' and them.user_id = profiles.id
  )
);

-- plans / activités : le staff du club lit ceux des membres (suivi 360°).
drop policy if exists plans_club_staff_read on public.plans;
create policy plans_club_staff_read on public.plans for select using (public.is_staff_of_user(user_id));
drop policy if exists activities_club_staff_read on public.synced_activities;
create policy activities_club_staff_read on public.synced_activities for select using (public.is_staff_of_user(user_id));
-- Un coach lit aussi les activités de ses athlètes hors club (coaching 1:1 existant).
drop policy if exists activities_coach_read on public.synced_activities;
create policy activities_coach_read on public.synced_activities for select using (
  exists (select 1 from public.coach_athletes ca
          where ca.coach_id = auth.uid() and ca.athlete_id = synced_activities.user_id and ca.status = 'active')
);

-- ── Capacité & liste d'attente (côté serveur, pour toutes les apps) ─────────
-- Une réservation « booked » sur une séance pleine devient « waitlist » ;
-- une place libérée (annulation / suppression) promeut le 1er de la liste d'attente.
create or replace function public.club_booking_capacity()
returns trigger language plpgsql security definer set search_path = public as $$
declare cap int; n int;
begin
  if new.status = 'booked' then
    select capacity into cap from public.club_sessions where id = new.session_id for update;
    if cap is not null then
      select count(*) into n from public.club_bookings
      where session_id = new.session_id and status = 'booked' and id <> new.id;
      if n >= cap then new.status := 'waitlist'; end if;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists club_booking_capacity on public.club_bookings;
create trigger club_booking_capacity before insert or update of status on public.club_bookings
  for each row execute function public.club_booking_capacity();

create or replace function public.club_booking_promote()
returns trigger language plpgsql security definer set search_path = public as $$
declare sid uuid; nxt uuid;
begin
  sid := coalesce(old.session_id, new.session_id);
  if old.status = 'booked' and (tg_op = 'DELETE' or new.status <> 'booked') then
    select id into nxt from public.club_bookings
    where session_id = sid and status = 'waitlist' order by created_at limit 1;
    if nxt is not null then
      update public.club_bookings set status = 'booked' where id = nxt;
    end if;
  end if;
  return null;
end $$;

drop trigger if exists club_booking_promote on public.club_bookings;
create trigger club_booking_promote after delete or update of status on public.club_bookings
  for each row execute function public.club_booking_promote();

-- ── RPC ─────────────────────────────────────────────────────────────────────
-- Crée un club ; le créateur en devient admin + coach.
create or replace function public.create_club(p_name text, p_city text default null)
returns public.clubs language plpgsql security definer set search_path = public as $$
declare c public.clubs;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  insert into public.clubs(name, city, created_by) values (trim(p_name), nullif(trim(p_city), ''), auth.uid())
  returning * into c;
  insert into public.club_members(club_id, user_id, roles, status)
  values (c.id, auth.uid(), array['admin','coach'], 'active');
  insert into public.club_groups(club_id, name, color) values
    (c.id, 'Compétition', '#9E1B2B'), (c.id, 'Loisir', '#0E9AAE'), (c.id, 'Découverte', '#A0407A');
  return c;
end $$;

-- Rejoindre un club avec son code (depuis l'app athlète ou le portail).
create or replace function public.join_club(p_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare cid uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select id into cid from public.clubs where invite_code = upper(trim(p_code));
  if cid is null then raise exception 'invalid_code'; end if;
  insert into public.club_members(club_id, user_id, roles, status)
  values (cid, auth.uid(), array['athlete'], 'active')
  on conflict (club_id, user_id) where user_id is not null do update set status = 'active';
  return cid;
end $$;

-- Rattache les invitations envoyées à l'email du compte courant (à appeler après connexion).
create or replace function public.claim_club_invites()
returns int language plpgsql security definer set search_path = public as $$
declare n int; em text;
begin
  select lower(email) into em from auth.users where id = auth.uid();
  if em is null then return 0; end if;
  update public.club_members m set user_id = auth.uid(), status = 'active', invite_email = null
  where m.user_id is null and lower(m.invite_email) = em
    and not exists (select 1 from public.club_members x where x.club_id = m.club_id and x.user_id = auth.uid());
  get diagnostics n = row_count;
  -- Les rôles coach/admin donnent accès au portail.
  update public.profiles set role = 'coach'
  where id = auth.uid() and coalesce(role, '') not in ('coach','admin')
    and exists (select 1 from public.club_members where user_id = auth.uid()
                and ('coach' = any(roles) or 'admin' = any(roles)));
  return n;
end $$;

-- Assigne (ou retire) le coach référent d'un membre ; tient coach_athletes à jour.
create or replace function public.assign_club_coach(p_member uuid, p_coach uuid)
returns void language plpgsql security definer set search_path = public as $$
declare m public.club_members;
begin
  select * into m from public.club_members where id = p_member;
  if m.id is null or not public.club_role(m.club_id, 'admin') then raise exception 'forbidden'; end if;
  if p_coach is not null and not exists (
    select 1 from public.club_members where club_id = m.club_id and user_id = p_coach and 'coach' = any(roles)
  ) then raise exception 'not_a_club_coach'; end if;

  -- L'ancien coach perd la relation créée par le club.
  if m.coach_id is not null and m.user_id is not null and m.coach_id is distinct from p_coach then
    delete from public.coach_athletes
    where coach_id = m.coach_id and athlete_id = m.user_id;
  end if;

  update public.club_members set coach_id = p_coach where id = p_member;

  if p_coach is not null and m.user_id is not null then
    if exists (select 1 from public.coach_athletes where coach_id = p_coach and athlete_id = m.user_id) then
      update public.coach_athletes set status = 'active', started_at = coalesce(started_at, now())
      where coach_id = p_coach and athlete_id = m.user_id;
    else
      insert into public.coach_athletes(coach_id, athlete_id, status, started_at)
      values (p_coach, m.user_id, 'active', now());
    end if;
  end if;
end $$;

grant execute on function public.create_club(text, text)          to authenticated;
grant execute on function public.join_club(text)                  to authenticated;
grant execute on function public.claim_club_invites()             to authenticated;
grant execute on function public.assign_club_coach(uuid, uuid)    to authenticated;

-- ============================================================================
-- V2 — Durcissement des règles + séances « à faire » + annonces
-- ============================================================================

-- Groupe de l'utilisateur courant dans un club (null = pas de groupe).
create or replace function public.my_club_group(p_club uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select group_id from public.club_members
  where club_id = p_club and user_id = auth.uid() and status = 'active' limit 1;
$$;

-- Séance ouverte à l'utilisateur courant : club du membre + (tout le club ou son groupe).
create or replace function public.session_open_to_me(p_session uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.club_sessions s
    where s.id = p_session and public.is_club_member(s.club_id)
      and (s.group_id is null or s.group_id = public.my_club_group(s.club_id))
  );
$$;

-- ── Membres : un athlète ne voit que lui, le staff et son groupe ────────────
drop policy if exists members_read on public.club_members;
create policy members_read on public.club_members for select using (
  user_id = auth.uid()
  or public.is_club_staff(club_id)
  or (public.is_club_member(club_id) and ('coach' = any(roles) or 'admin' = any(roles)))
  or (public.is_club_member(club_id) and group_id is not null and group_id = public.my_club_group(club_id))
);

-- ── Profils : staff → tout le club ; athlète → coachs/admins + son groupe ──
drop policy if exists profiles_club_read on public.profiles;
create policy profiles_club_read on public.profiles for select using (
  exists (
    select 1 from public.club_members them
    where them.user_id = profiles.id and them.status = 'active'
      and (
        public.is_club_staff(them.club_id)
        or (public.is_club_member(them.club_id) and ('coach' = any(them.roles) or 'admin' = any(them.roles)))
        or (public.is_club_member(them.club_id) and them.group_id is not null and them.group_id = public.my_club_group(them.club_id))
      )
  )
);

-- ── Séances : un athlète ne voit que celles de tout le club ou de son groupe ─
drop policy if exists sessions_read on public.club_sessions;
create policy sessions_read on public.club_sessions for select using (
  public.is_club_staff(club_id)
  or (public.is_club_member(club_id) and (group_id is null or group_id = public.my_club_group(club_id)))
);

-- ── Réservations : séance ouverte, à venir ; présence = staff uniquement ────
drop policy if exists bookings_own_insert on public.club_bookings;
create policy bookings_own_insert on public.club_bookings for insert with check (
  user_id = auth.uid()
  and status in ('booked', 'waitlist')
  and public.session_open_to_me(session_id)
  and exists (select 1 from public.club_sessions s where s.id = session_id and s.starts_at > now())
);

-- SECURITY INVOKER (pas definer) : sinon current_user vaut le propriétaire de la
-- fonction, jamais 'authenticated', et le garde-fou ne s'applique pas.
create or replace function public.club_booking_guard()
returns trigger language plpgsql security invoker set search_path = public as $$
declare staff boolean;
begin
  select public.is_club_staff(s.club_id) into staff from public.club_sessions s where s.id = new.session_id;
  if current_user = 'authenticated' and not coalesce(staff, false) then
    if tg_op = 'INSERT' then
      new.attended := null;
    else
      new.attended := old.attended;
      new.session_id := old.session_id;
      new.user_id := old.user_id;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists club_booking_guard on public.club_bookings;
create trigger club_booking_guard before insert or update on public.club_bookings
  for each row execute function public.club_booking_guard();

-- ── Séances « à faire » (prescrites par un coach, sans réservation) ─────────
-- Cible : tout le club (group_id et athlete_id null), un groupe, ou un athlète.
create table if not exists public.club_workouts (
  id           uuid primary key default gen_random_uuid(),
  club_id      uuid not null references public.clubs(id) on delete cascade,
  coach_id     uuid references public.profiles(id) on delete set null,
  group_id     uuid references public.club_groups(id) on delete cascade,
  athlete_id   uuid references public.profiles(id) on delete cascade,
  date         date not null,
  sport        text not null default 'run',
  title        text not null,
  description  text,
  duration_min int  not null default 45,
  zone         text,
  tss          int,
  blocks       jsonb not null default '[]'::jsonb,
  created_at   timestamptz not null default now()
);
create index if not exists club_workouts_club_date on public.club_workouts(club_id, date);

create table if not exists public.club_workout_logs (
  id          uuid primary key default gen_random_uuid(),
  workout_id  uuid not null references public.club_workouts(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  status      text not null default 'done' check (status in ('done', 'skipped')),
  rpe         int check (rpe between 1 and 10),
  comment     text,
  created_at  timestamptz not null default now(),
  unique (workout_id, user_id)
);

alter table public.club_workouts     enable row level security;
alter table public.club_workout_logs enable row level security;

drop policy if exists workouts_read on public.club_workouts;
create policy workouts_read on public.club_workouts for select using (
  public.is_club_staff(club_id)
  or (public.is_club_member(club_id)
      and (athlete_id = auth.uid()
           or (athlete_id is null and (group_id is null or group_id = public.my_club_group(club_id)))))
);
drop policy if exists workouts_staff_write on public.club_workouts;
create policy workouts_staff_write on public.club_workouts for all
  using (public.is_club_staff(club_id)) with check (public.is_club_staff(club_id));

drop policy if exists workout_logs_own on public.club_workout_logs;
create policy workout_logs_own on public.club_workout_logs for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and exists (
    select 1 from public.club_workouts w where w.id = workout_id
      and public.is_club_member(w.club_id)
      and (w.athlete_id = auth.uid() or (w.athlete_id is null and (w.group_id is null or w.group_id = public.my_club_group(w.club_id))))
  ));
drop policy if exists workout_logs_staff_read on public.club_workout_logs;
create policy workout_logs_staff_read on public.club_workout_logs for select using (
  exists (select 1 from public.club_workouts w where w.id = workout_id and public.is_club_staff(w.club_id))
);

-- ── Annonces du club (à tout le club ou à un groupe) ────────────────────────
create table if not exists public.club_announcements (
  id         uuid primary key default gen_random_uuid(),
  club_id    uuid not null references public.clubs(id) on delete cascade,
  author_id  uuid references public.profiles(id) on delete set null,
  group_id   uuid references public.club_groups(id) on delete cascade,
  title      text not null,
  body       text,
  pinned     boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists club_announcements_club on public.club_announcements(club_id, created_at desc);
alter table public.club_announcements enable row level security;

drop policy if exists announcements_read on public.club_announcements;
create policy announcements_read on public.club_announcements for select using (
  public.is_club_staff(club_id)
  or (public.is_club_member(club_id) and (group_id is null or group_id = public.my_club_group(club_id)))
);
drop policy if exists announcements_staff_write on public.club_announcements;
create policy announcements_staff_write on public.club_announcements for all
  using (public.is_club_staff(club_id)) with check (public.is_club_staff(club_id));

-- ── Retirer un membre / changer ses rôles : jamais le dernier admin ─────────
create or replace function public.club_keep_one_admin()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Suppression du club entier (cascade) : rien à protéger.
  if not exists (select 1 from public.clubs where id = old.club_id) then
    return coalesce(new, old);
  end if;
  if (tg_op = 'DELETE' and 'admin' = any(old.roles))
     or (tg_op = 'UPDATE' and 'admin' = any(old.roles) and not ('admin' = any(new.roles))) then
    if not exists (select 1 from public.club_members
                   where club_id = old.club_id and id <> old.id and 'admin' = any(roles) and status = 'active') then
      raise exception 'last_admin';
    end if;
  end if;
  return coalesce(new, old);
end $$;
drop trigger if exists club_keep_one_admin on public.club_members;
create trigger club_keep_one_admin before update or delete on public.club_members
  for each row execute function public.club_keep_one_admin();

-- ── Correctif de sécurité (préexistant) : protect_premium_columns ───────────
-- En SECURITY DEFINER, current_user = postgres → le test « current_user =
-- 'authenticated' » n'était jamais vrai : n'importe quel utilisateur pouvait se
-- passer Premium ou coach. En INVOKER, le garde-fou s'applique aux requêtes
-- client ; les RPC definer (claim_coach_code…) et les edge functions
-- (service_role) restent autorisées.
alter function public.protect_premium_columns() security invoker;

-- ============================================================================
-- V3 — Rejoindre un club depuis l'app avec un rôle (athlète / coach / admin)
-- ============================================================================
-- Un athlète rejoint directement. Un coach ou admin rejoint comme athlète avec
-- une demande de rôle (requested_role) que l'admin du club valide dans le portail.
alter table public.club_members add column if not exists requested_role text
  check (requested_role in ('coach', 'admin'));

drop function if exists public.join_club(text);
create or replace function public.join_club(p_code text, p_role text default 'athlete')
returns uuid language plpgsql security definer set search_path = public as $$
declare cid uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select id into cid from public.clubs where invite_code = upper(trim(p_code));
  if cid is null then raise exception 'invalid_code'; end if;
  insert into public.club_members(club_id, user_id, roles, status, requested_role)
  values (cid, auth.uid(), array['athlete'], 'active',
          case when p_role in ('coach', 'admin') then p_role end)
  on conflict (club_id, user_id) where user_id is not null do update
    set status = 'active',
        requested_role = coalesce(case when p_role in ('coach', 'admin') then p_role end, club_members.requested_role);
  return cid;
end $$;
grant execute on function public.join_club(text, text) to authenticated;

-- L'admin accepte ou refuse la demande de rôle d'un membre.
create or replace function public.resolve_club_role_request(p_member uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = public as $$
declare m public.club_members;
begin
  select * into m from public.club_members where id = p_member;
  if m.id is null or not public.club_role(m.club_id, 'admin') then raise exception 'forbidden'; end if;
  if m.requested_role is null then return; end if;
  if p_accept then
    update public.club_members
      set roles = (select array_agg(distinct r) from unnest(roles || case when m.requested_role = 'admin'
                     then array['admin','coach'] else array['coach'] end) r),
          requested_role = null
      where id = p_member;
    -- Accès au portail coach.
    update public.profiles set role = 'coach'
      where id = m.user_id and coalesce(role, '') not in ('coach', 'admin');
  else
    update public.club_members set requested_role = null where id = p_member;
  end if;
end $$;
grant execute on function public.resolve_club_role_request(uuid, boolean) to authenticated;

-- Le club de l'utilisateur courant (pour l'app : savoir s'il est en mode club).
create or replace function public.my_club()
returns table (club_id uuid, club_name text, roles text[], requested_role text, group_id uuid)
language sql stable security definer set search_path = public as $$
  select m.club_id, c.name, m.roles, m.requested_role, m.group_id
  from public.club_members m join public.clubs c on c.id = m.club_id
  where m.user_id = auth.uid() and m.status = 'active'
  order by m.joined_at limit 1;
$$;
grant execute on function public.my_club() to authenticated;

-- ============================================================================
-- V4 — Niveau triathlon (questions d'inscription club) + accès portail du créateur
-- ============================================================================
alter table public.profiles add column if not exists tri_level text
  check (tri_level in ('beginner', 'intermediate', 'advanced'));  -- valeurs envoyées par l'app iOS

-- Le créateur d'un club (admin + coach) a accès au portail tout de suite.
create or replace function public.create_club(p_name text, p_city text default null)
returns public.clubs language plpgsql security definer set search_path = public as $$
declare c public.clubs;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  insert into public.clubs(name, city, created_by) values (trim(p_name), nullif(trim(p_city), ''), auth.uid())
  returning * into c;
  insert into public.club_members(club_id, user_id, roles, status)
  values (c.id, auth.uid(), array['admin','coach'], 'active');
  insert into public.club_groups(club_id, name, color) values
    (c.id, 'Compétition', '#9E1B2B'), (c.id, 'Loisir', '#0E9AAE'), (c.id, 'Découverte', '#A0407A');
  update public.profiles set role = 'coach'
    where id = auth.uid() and coalesce(role, '') not in ('coach', 'admin');
  return c;
end $$;

-- ============================================================================
-- V5 — Correctifs suite à la revue iOS
-- ============================================================================
-- join_club : un coach/admin déjà en place qui rejoint à nouveau ne recrée pas de demande.
create or replace function public.join_club(p_code text, p_role text default 'athlete')
returns uuid language plpgsql security definer set search_path = public as $$
declare cid uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select id into cid from public.clubs where invite_code = upper(trim(p_code));
  if cid is null then raise exception 'invalid_code'; end if;
  insert into public.club_members(club_id, user_id, roles, status, requested_role)
  values (cid, auth.uid(), array['athlete'], 'active',
          case when p_role in ('coach', 'admin') then p_role end)
  on conflict (club_id, user_id) where user_id is not null do update
    set status = 'active',
        requested_role = case
          when p_role in ('coach', 'admin') and not (p_role = any(club_members.roles)) then p_role
          else club_members.requested_role end;
  return cid;
end $$;

-- Un membre peut quitter son club (le dernier admin reste protégé par club_keep_one_admin).
create or replace function public.leave_club(p_club uuid)
returns void language plpgsql security definer set search_path = public as $$
declare m public.club_members;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select * into m from public.club_members where club_id = p_club and user_id = auth.uid();
  if m.id is null then return; end if;
  if m.coach_id is not null then
    delete from public.coach_athletes where coach_id = m.coach_id and athlete_id = auth.uid();
  end if;
  delete from public.club_bookings b using public.club_sessions s
    where b.session_id = s.id and s.club_id = p_club and b.user_id = auth.uid() and s.starts_at > now();
  delete from public.club_members where id = m.id;
end $$;
grant execute on function public.leave_club(uuid) to authenticated;

-- ============================================================================
-- V6 — Correctifs de sécurité (audit 2026-10-01) sur des objets préexistants
-- ============================================================================
create or replace function public.is_app_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- C1 — Fonctions d'administration : réservées aux admins GEMS (avant : appelables par anon).
create or replace function public.admin_list_admins()
returns table(id uuid, full_name text, email text) language plpgsql security definer set search_path = public as $$
begin
  if not public.is_app_admin() then raise exception 'forbidden'; end if;
  return query select p.id, p.full_name, u.email::text
    from public.profiles p join auth.users u on p.id = u.id where p.role = 'admin';
end $$;

create or replace function public.admin_set_role_by_email(target_email text, new_role text)
returns text language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.is_app_admin() then raise exception 'forbidden'; end if;
  if new_role not in ('athlete', 'coach', 'admin') then raise exception 'invalid_role'; end if;
  select id into v_id from auth.users where email = target_email;
  if v_id is null then return 'not_found'; end if;
  update public.profiles set role = new_role where id = v_id;
  return 'ok';
end $$;

create or replace function public.admin_set_role_by_id(target_id uuid, new_role text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_app_admin() then raise exception 'forbidden'; end if;
  if new_role not in ('athlete', 'coach', 'admin') then raise exception 'invalid_role'; end if;
  update public.profiles set role = new_role where id = target_id;
end $$;

revoke execute on function public.admin_list_admins() from anon, public;
revoke execute on function public.admin_set_role_by_email(text, text) from anon, public;
revoke execute on function public.admin_set_role_by_id(uuid, text) from anon, public;
grant execute on function public.admin_list_admins() to authenticated;
grant execute on function public.admin_set_role_by_email(text, text) to authenticated;
grant execute on function public.admin_set_role_by_id(uuid, text) to authenticated;

-- C2 — coach_athletes : plus de relation « coach » auto-déclarée sur n'importe quel athlète.
-- Insertion : l'athlète fait une demande (pending), ou un coach vérifié accepte quelqu'un
-- de la file d'attente / d'un club où il est staff.
drop policy if exists "coach_athletes: insert as coach" on public.coach_athletes;
drop policy if exists coach_inserts_own_relation on public.coach_athletes;
drop policy if exists coach_athletes_insert on public.coach_athletes;
create policy coach_athletes_insert on public.coach_athletes for insert with check (
  (auth.uid() = athlete_id and status = 'pending')
  or (public.is_coach() and coach_id = auth.uid() and (
        exists (select 1 from public.coach_waitlist w where w.user_id = athlete_id)
        or public.is_staff_of_user(athlete_id)))
);
-- ca_coach était « ALL » : son USING servait aussi de WITH CHECK à l'insertion → découpé.
drop policy if exists ca_coach on public.coach_athletes;
drop policy if exists ca_read on public.coach_athletes;
drop policy if exists ca_update on public.coach_athletes;
drop policy if exists ca_delete on public.coach_athletes;
create policy ca_read on public.coach_athletes for select using (coach_id = auth.uid() or athlete_id = auth.uid());
create policy ca_update on public.coach_athletes for update
  using (coach_id = auth.uid() or athlete_id = auth.uid())
  with check (coach_id = auth.uid() or athlete_id = auth.uid());
create policy ca_delete on public.coach_athletes for delete using (coach_id = auth.uid() or athlete_id = auth.uid());

-- Une relation ne peut pas changer de coach ou d'athlète après coup (côté client).
create or replace function public.coach_athletes_freeze_ids()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if current_user = 'authenticated' and (new.coach_id is distinct from old.coach_id or new.athlete_id is distinct from old.athlete_id) then
    raise exception 'forbidden';
  end if;
  -- Seul le coach (ou le serveur) passe une demande en « active ».
  if current_user = 'authenticated' and new.status = 'active' and old.status <> 'active' and auth.uid() <> new.coach_id then
    raise exception 'forbidden';
  end if;
  return new;
end $$;
drop trigger if exists coach_athletes_freeze_ids on public.coach_athletes;
create trigger coach_athletes_freeze_ids before update on public.coach_athletes
  for each row execute function public.coach_athletes_freeze_ids();

-- H2 — Strava : on ne consomme que son propre jeton (le serveur garde la main).
create or replace function public.consume_strava_pending_token(p_user_id uuid)
returns setof public.strava_pending_tokens language plpgsql security definer set search_path = public as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' and auth.uid() is distinct from p_user_id then
    raise exception 'forbidden';
  end if;
  return query delete from public.strava_pending_tokens where user_id = p_user_id::text returning *;
end $$;
revoke execute on function public.consume_strava_pending_token(uuid) from anon, public;
grant execute on function public.consume_strava_pending_token(uuid) to authenticated;

-- L1 — Retours (feedback) : lisibles par les admins GEMS uniquement (page /dashboard/retours).
drop policy if exists "Authentifiés peuvent lire les retours" on public.feedback;
drop policy if exists feedback_admin_read on public.feedback;
create policy feedback_admin_read on public.feedback for select using (public.is_app_admin());

-- H1 (étape 1) — Vérifier un code coach sans pouvoir lister la table.
create or replace function public.check_coach_code(p_code text)
returns text language sql stable security definer set search_path = public as $$
  select case
    when not exists (select 1 from public.coach_codes where code = upper(trim(p_code))) then 'invalid'
    when exists (select 1 from public.coach_codes where code = upper(trim(p_code)) and used_by is not null) then 'used'
    else 'ok' end;
$$;
grant execute on function public.check_coach_code(text) to anon, authenticated;

-- ============================================================================
-- V7 — M1 : annuaire du club sans données personnelles
-- ============================================================================
-- Les athlètes n'ont besoin que du nom et de la photo des autres membres : on passe
-- par un annuaire restreint, et seuls les coachs/admins lisent les profils complets.
create or replace function public.club_directory(p_club uuid)
returns table (user_id uuid, full_name text, photo_url text, group_id uuid, roles text[])
language sql stable security definer set search_path = public as $$
  select m.user_id, p.full_name, p.photo_url, m.group_id, m.roles
  from public.club_members m join public.profiles p on p.id = m.user_id
  where m.club_id = p_club and m.status = 'active'
    and public.is_club_member(p_club)
    and (
      public.is_club_staff(p_club)
      or m.user_id = auth.uid()
      or 'coach' = any(m.roles) or 'admin' = any(m.roles)
      or (m.group_id is not null and m.group_id = public.my_club_group(p_club))
    );
$$;
grant execute on function public.club_directory(uuid) to authenticated;

-- Profils complets (email, téléphone, blessures…) : staff du club uniquement.
drop policy if exists profiles_club_read on public.profiles;
create policy profiles_club_read on public.profiles for select using (
  exists (
    select 1 from public.club_members them
    where them.user_id = profiles.id and them.status = 'active' and public.is_club_staff(them.club_id)
  )
);

-- H1 (étape 2, après déploiement du site qui utilise check_coach_code) :
-- la table des codes coach n'est plus lisible ni modifiable par les clients.
drop policy if exists coach_codes_read on public.coach_codes;
drop policy if exists "coach_codes: claim own code" on public.coach_codes;

-- ============================================================================
-- V8 — Pro inclus pour les membres actifs d'un club
-- ============================================================================
-- premium_type = 'club' : accès Pro accordé par le club (l'app traite tout type ≠ 'free'
-- avec une date d'expiration future comme Premium). Un abonnement payé (premium / dev)
-- n'est jamais écrasé. Expiration = fin d'adhésion si renseignée, sinon +1 an glissant.
create or replace function public.sync_club_premium(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare until timestamptz; cur text;
begin
  if p_user is null then return; end if;
  select premium_type into cur from public.profiles where id = p_user;
  select max(coalesce(m.membership_until::timestamptz + interval '1 day', now() + interval '1 year'))
    into until
    from public.club_members m
    where m.user_id = p_user and m.status = 'active'
      and (m.membership_until is null or m.membership_until >= current_date);
  if until is not null then
    -- Membre actif : Pro « club », sauf abonnement payé encore valide.
    update public.profiles set premium_type = 'club', premium_expires_at = until
      where id = p_user
        and (coalesce(premium_type, 'free') in ('free', 'club')
             or (premium_type = 'premium' and coalesce(premium_expires_at, now()) <= now()));
  elsif cur = 'club' then
    -- Plus membre (ou adhésion expirée) : retour au gratuit.
    update public.profiles set premium_type = 'free', premium_expires_at = null where id = p_user;
  end if;
end $$;

create or replace function public.club_members_sync_premium()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then perform public.sync_club_premium(old.user_id); end if;
  if tg_op in ('INSERT', 'UPDATE') then perform public.sync_club_premium(new.user_id); end if;
  return coalesce(new, old);
end $$;
drop trigger if exists club_members_sync_premium on public.club_members;
create trigger club_members_sync_premium after insert or update or delete on public.club_members
  for each row execute function public.club_members_sync_premium();

-- Rattrapage pour les membres existants.
select public.sync_club_premium(user_id) from public.club_members where user_id is not null;

-- ============================================================================
-- V9 — Rôle développeur GEMS (console dev : inscrits, stats, clubs, vue « en tant que »)
-- Validé explicitement par Eloi le 2026-10-02 : lecture de toutes les données.
-- ============================================================================
create table if not exists public.gems_devs (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  added_by   uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.gems_devs enable row level security;

create or replace function public.is_gems_dev()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.gems_devs where user_id = auth.uid());
$$;
grant execute on function public.is_gems_dev() to authenticated;

drop policy if exists gems_devs_read on public.gems_devs;
create policy gems_devs_read on public.gems_devs for select using (public.is_gems_dev());

insert into public.gems_devs(user_id)
select id from public.profiles where email in ('eloi.dumas.92@gmail.com', 'gustavefournier2004@gmail.com')
on conflict do nothing;

do $$
declare t text;
begin
  foreach t in array array['clubs','club_groups','club_members','club_sessions','club_bookings',
                           'club_workouts','club_workout_logs','club_announcements','profiles',
                           'plans','synced_activities','coach_athletes','coach_notes','coach_waitlist']
  loop
    execute format('drop policy if exists dev_read on public.%I', t);
    execute format('create policy dev_read on public.%I for select using (public.is_gems_dev())', t);
  end loop;
end $$;

create table if not exists public.site_page_views (
  day   date not null default current_date,
  path  text not null,
  views int  not null default 0,
  primary key (day, path)
);
alter table public.site_page_views enable row level security;
drop policy if exists site_page_views_dev_read on public.site_page_views;
create policy site_page_views_dev_read on public.site_page_views for select using (public.is_gems_dev());

create or replace function public.track_page_view(p_path text)
returns void language sql security definer set search_path = public as $$
  insert into public.site_page_views(day, path, views)
  values (current_date, left(coalesce(nullif(regexp_replace(p_path, '\?.*$', ''), ''), '/'), 120), 1)
  on conflict (day, path) do update set views = site_page_views.views + 1;
$$;
grant execute on function public.track_page_view(text) to anon, authenticated;

create or replace function public.dev_recent_signups(p_limit int default 10)
returns table (id uuid, email text, full_name text, created_at timestamptz, last_sign_in_at timestamptz,
               provider text, role text, premium_type text, has_plan boolean, club_name text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_gems_dev() then raise exception 'forbidden'; end if;
  return query
  select u.id, u.email::text, p.full_name, u.created_at, u.last_sign_in_at,
         coalesce(u.raw_app_meta_data->>'provider', 'email'), p.role, p.premium_type,
         exists (select 1 from public.plans pl where pl.user_id = u.id),
         (select c.name from public.club_members m join public.clubs c on c.id = m.club_id
           where m.user_id = u.id and m.status = 'active' limit 1)
  from auth.users u left join public.profiles p on p.id = u.id
  order by u.created_at desc
  limit least(greatest(coalesce(p_limit, 10), 1), 200);
end $$;
grant execute on function public.dev_recent_signups(int) to authenticated;

create or replace function public.dev_stats()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  if not public.is_gems_dev() then raise exception 'forbidden'; end if;
  select jsonb_build_object(
    'users_total',        (select count(*) from auth.users),
    'users_7d',           (select count(*) from auth.users where created_at > now() - interval '7 days'),
    'users_30d',          (select count(*) from auth.users where created_at > now() - interval '30 days'),
    'active_7d',          (select count(*) from auth.users where last_sign_in_at > now() - interval '7 days'),
    'active_30d',         (select count(*) from auth.users where last_sign_in_at > now() - interval '30 days'),
    'premium_by_type',    (select coalesce(jsonb_object_agg(t, n), '{}'::jsonb) from (
                             select coalesce(premium_type, 'free') t, count(*) n from public.profiles
                             where coalesce(premium_type, 'free') = 'free' or premium_expires_at > now() or premium_type = 'dev'
                             group by 1) s),
    'roles',              (select coalesce(jsonb_object_agg(coalesce(role, '?'), n), '{}'::jsonb) from (
                             select role, count(*) n from public.profiles group by 1) s),
    'plans_total',        (select count(*) from public.plans),
    'plans_active',       (select count(*) from public.plans where is_active),
    'plans_7d',           (select count(*) from public.plans where created_at > now() - interval '7 days'),
    'activities_7d',      (select count(*) from public.synced_activities where date > now() - interval '7 days'),
    'strava_connected',   (select count(*) from public.strava_tokens),
    'messages_7d',        (select count(*) from public.messages where created_at > now() - interval '7 days'),
    'coach_relations',    (select count(*) from public.coach_athletes where status = 'active'),
    'clubs',              (select count(*) from public.clubs),
    'club_members',       (select count(*) from public.club_members where status = 'active' and user_id is not null),
    'club_sessions_7d',   (select count(*) from public.club_sessions where starts_at between now() - interval '7 days' and now()),
    'bookings_7d',        (select count(*) from public.club_bookings where created_at > now() - interval '7 days'),
    'workout_logs_7d',    (select count(*) from public.club_workout_logs where created_at > now() - interval '7 days'),
    'signups_by_day',     (select coalesce(jsonb_agg(jsonb_build_object('day', d, 'n', n) order by d), '[]'::jsonb) from (
                             select created_at::date d, count(*) n from auth.users
                             where created_at > now() - interval '30 days' group by 1) s),
    'site_views_by_day',  (select coalesce(jsonb_agg(jsonb_build_object('day', day, 'n', n) order by day), '[]'::jsonb) from (
                             select day, sum(views) n from public.site_page_views
                             where day > current_date - 30 group by 1) s),
    'site_top_pages',     (select coalesce(jsonb_agg(jsonb_build_object('path', path, 'n', n) order by n desc), '[]'::jsonb) from (
                             select path, sum(views) n from public.site_page_views
                             where day > current_date - 30 group by 1 order by 2 desc limit 10) s)
  ) into r;
  return r;
end $$;
grant execute on function public.dev_stats() to authenticated;

create or replace function public.dev_clubs()
returns table (id uuid, name text, city text, invite_code text, seats int, created_at timestamptz,
               admins jsonb, athletes int, coaches int, invited int, role_requests int,
               sessions_upcoming int, bookings_30d int, workouts_30d int, last_activity timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_gems_dev() then raise exception 'forbidden'; end if;
  return query
  select c.id, c.name, c.city, c.invite_code, c.seats, c.created_at,
    (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'name', p.full_name, 'email', p.email)), '[]'::jsonb)
       from public.club_members m join public.profiles p on p.id = m.user_id
       where m.club_id = c.id and 'admin' = any(m.roles) and m.status = 'active'),
    (select count(*)::int from public.club_members m where m.club_id = c.id and m.status = 'active' and m.user_id is not null and 'athlete' = any(m.roles)),
    (select count(*)::int from public.club_members m where m.club_id = c.id and m.status = 'active' and 'coach' = any(m.roles)),
    (select count(*)::int from public.club_members m where m.club_id = c.id and m.user_id is null),
    (select count(*)::int from public.club_members m where m.club_id = c.id and m.requested_role is not null),
    (select count(*)::int from public.club_sessions s where s.club_id = c.id and s.starts_at > now()),
    (select count(*)::int from public.club_bookings b join public.club_sessions s on s.id = b.session_id
       where s.club_id = c.id and b.created_at > now() - interval '30 days'),
    (select count(*)::int from public.club_workouts w where w.club_id = c.id and w.created_at > now() - interval '30 days'),
    greatest(
      (select max(b.created_at) from public.club_bookings b join public.club_sessions s on s.id = b.session_id where s.club_id = c.id),
      (select max(w.created_at) from public.club_workouts w where w.club_id = c.id),
      (select max(m.joined_at) from public.club_members m where m.club_id = c.id))
  from public.clubs c
  order by c.created_at desc;
end $$;
grant execute on function public.dev_clubs() to authenticated;

create or replace function public.dev_set_dev(p_email text, p_on boolean)
returns text language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  if not public.is_gems_dev() then raise exception 'forbidden'; end if;
  select id into v from public.profiles where lower(email) = lower(trim(p_email));
  if v is null then return 'not_found'; end if;
  if p_on then
    insert into public.gems_devs(user_id, added_by) values (v, auth.uid()) on conflict do nothing;
  else
    if v = auth.uid() then raise exception 'cannot_remove_self'; end if;
    delete from public.gems_devs where user_id = v;
  end if;
  return 'ok';
end $$;
grant execute on function public.dev_set_dev(text, boolean) to authenticated;

-- V9 bis — messages coach ↔ athlète lisibles par les développeurs (« Voir en tant que »).
drop policy if exists dev_read on public.messages;
create policy dev_read on public.messages for select using (public.is_gems_dev());

-- ============================================================================
-- V11 — Audit sécurité base (2026-10-02) : clubs, invitations, stockage,
--        messages, profils, plans, notes, file d'attente, promo, essai gratuit
-- ============================================================================

-- ── C1 : un admin de club n'ajoute personne d'autorité ───────────────────────
drop policy if exists members_admin_write  on public.club_members;
drop policy if exists members_admin_insert on public.club_members;
drop policy if exists members_admin_update on public.club_members;
drop policy if exists members_admin_delete on public.club_members;
create policy members_admin_insert on public.club_members for insert to authenticated
  with check (public.club_role(club_id, 'admin') and user_id is null and status = 'invited' and invite_email is not null);
create policy members_admin_update on public.club_members for update to authenticated
  using (public.club_role(club_id, 'admin')) with check (public.club_role(club_id, 'admin'));
create policy members_admin_delete on public.club_members for delete to authenticated
  using (public.club_role(club_id, 'admin'));

create or replace function public.club_members_freeze()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if current_user = 'authenticated' then
    if new.user_id is distinct from old.user_id or new.club_id is distinct from old.club_id
       or new.invite_email is distinct from old.invite_email or new.joined_at is distinct from old.joined_at
       or new.requested_role is distinct from old.requested_role then
      raise exception 'forbidden';
    end if;
    -- Un admin ne réactive pas d'autorité une invitation en attente.
    if old.status = 'invited' and new.status <> 'invited' then raise exception 'forbidden'; end if;
  end if;
  return new;
end $$;
drop trigger if exists club_members_freeze on public.club_members;
create trigger club_members_freeze before update on public.club_members
  for each row execute function public.club_members_freeze();

create or replace function public.is_staff_of_user(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.club_members me
    join public.club_members them on them.club_id = me.club_id
    where me.user_id = auth.uid() and me.status = 'active'
      and ('admin' = any(me.roles) or 'coach' = any(me.roles))
      and them.user_id = p_user and them.status = 'active');
$$;

-- ── C2 : invitations = consentement explicite ───────────────────────────────
create or replace function public.claim_club_invites()
returns int language plpgsql security definer set search_path = public as $$
declare n int; em text;
begin
  select lower(email) into em from auth.users where id = auth.uid() and email_confirmed_at is not null;
  if em is null then return 0; end if;
  -- Rattache l'invitation au compte (reste « invited » jusqu'à acceptation).
  update public.club_members m set user_id = auth.uid()
  where m.user_id is null and m.status = 'invited' and lower(m.invite_email) = em
    and not exists (select 1 from public.club_members x where x.club_id = m.club_id and x.user_id = auth.uid());
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function public.my_club_invites()
returns table (member_id uuid, club_id uuid, club_name text, club_city text, roles text[], invited_at timestamptz)
language sql stable security definer set search_path = public as $$
  select m.id, c.id, c.name, c.city, m.roles, m.joined_at
  from public.club_members m join public.clubs c on c.id = m.club_id
  where m.user_id = auth.uid() and m.status = 'invited'
  order by m.joined_at desc;
$$;

create or replace function public.accept_club_invite(p_member uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if not p_accept then
    delete from public.club_members where id = p_member and user_id = auth.uid() and status = 'invited';
    return;
  end if;
  update public.club_members set status = 'active', invite_email = null, joined_at = now()
   where id = p_member and user_id = auth.uid() and status = 'invited';
  if not found then raise exception 'not_found'; end if;
end $$;

-- ── H1 : un club créé n'est actif (Pro inclus) qu'après validation GEMS ─────
alter table public.clubs alter column plan_tier set default 'pending';
alter table public.clubs alter column invite_code
  set default upper(substr(translate(encode(gen_random_bytes(12), 'base64'), '+/=0O1Il', ''), 1, 8));

create or replace function public.create_club(p_name text, p_city text default null)
returns public.clubs language plpgsql security definer set search_path = public as $$
declare c public.clubs;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if length(trim(coalesce(p_name, ''))) < 2 or length(p_name) > 80 then raise exception 'invalid_name'; end if;
  if (select count(*) from public.clubs where created_by = auth.uid()) >= 3 then raise exception 'too_many_clubs'; end if;
  insert into public.clubs(name, city, created_by, plan_tier)
  values (trim(p_name), nullif(trim(left(coalesce(p_city, ''), 80)), ''), auth.uid(), 'pending')
  returning * into c;
  insert into public.club_members(club_id, user_id, roles, status) values (c.id, auth.uid(), array['admin','coach'], 'active');
  insert into public.club_groups(club_id, name, color) values
    (c.id, 'Compétition', '#9E1B2B'), (c.id, 'Loisir', '#0E9AAE'), (c.id, 'Découverte', '#A0407A');
  -- Plus de rôle « coach » global : l'accès au portail vient du rôle dans le club.
  return c;
end $$;

-- Les rôles de club ne donnent plus le rôle coach global (marketplace / file d'attente).
create or replace function public.resolve_club_role_request(p_member uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = public as $$
declare m public.club_members;
begin
  select * into m from public.club_members where id = p_member;
  if m.id is null or not public.club_role(m.club_id, 'admin') then raise exception 'forbidden'; end if;
  if m.requested_role is null then return; end if;
  if p_accept then
    update public.club_members
      set roles = (select array_agg(distinct r) from unnest(roles || case when m.requested_role = 'admin'
                     then array['admin','coach'] else array['coach'] end) r),
          requested_role = null
      where id = p_member;
  else
    update public.club_members set requested_role = null where id = p_member;
  end if;
end $$;

-- join_club : code plus robuste côté serveur, pas de réactivation d'un membre désactivé, sièges.
create or replace function public.join_club(p_code text, p_role text default 'athlete')
returns uuid language plpgsql security definer set search_path = public as $$
declare cid uuid; seats_max int; used int; existing public.club_members;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select id, seats into cid, seats_max from public.clubs where invite_code = upper(trim(p_code));
  if cid is null then raise exception 'invalid_code'; end if;
  select * into existing from public.club_members where club_id = cid and user_id = auth.uid();
  if existing.id is not null then
    if existing.status = 'inactive' then raise exception 'membership_disabled'; end if;
    if existing.status = 'invited' then
      update public.club_members set status = 'active', invite_email = null, joined_at = now() where id = existing.id;
    end if;
    if p_role in ('coach', 'admin') and not (p_role = any(existing.roles)) then
      update public.club_members set requested_role = p_role where id = existing.id;
    end if;
    return cid;
  end if;
  select count(*) into used from public.club_members where club_id = cid and status = 'active' and user_id is not null;
  if seats_max is not null and used >= seats_max then raise exception 'club_full'; end if;
  insert into public.club_members(club_id, user_id, roles, status, requested_role)
  values (cid, auth.uid(), array['athlete'], 'active', case when p_role in ('coach', 'admin') then p_role end);
  return cid;
end $$;

-- Pro « club » : uniquement pour les clubs validés (club_pro), durée plafonnée ;
-- en sortie de club, retour au gratuit sans rouvrir l'essai gratuit.
create or replace function public.sync_club_premium(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare until timestamptz; cur text;
begin
  if p_user is null then return; end if;
  select premium_type into cur from public.profiles where id = p_user;
  select max(least(coalesce(m.membership_until::timestamptz + interval '1 day', now() + interval '1 year'),
                   now() + interval '400 days'))
    into until
    from public.club_members m join public.clubs c on c.id = m.club_id
    where m.user_id = p_user and m.status = 'active' and c.plan_tier = 'club_pro'
      and (m.membership_until is null or m.membership_until >= current_date);
  if until is not null then
    update public.profiles set premium_type = 'club', premium_expires_at = until
      where id = p_user
        and (coalesce(premium_type, 'free') in ('free', 'club')
             or (premium_type = 'premium' and coalesce(premium_expires_at, now()) <= now()));
  elsif cur = 'club' then
    update public.profiles set premium_type = 'free', premium_expires_at = now() where id = p_user;
  end if;
end $$;
revoke execute on function public.sync_club_premium(uuid) from public, anon, authenticated;

-- Changement de formule d'un club → resynchronise ses membres.
create or replace function public.clubs_resync_premium()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.plan_tier is distinct from old.plan_tier then
    perform public.sync_club_premium(m.user_id) from public.club_members m where m.club_id = new.id and m.user_id is not null;
  end if;
  return new;
end $$;
drop trigger if exists clubs_resync_premium on public.clubs;
create trigger clubs_resync_premium after update on public.clubs
  for each row execute function public.clubs_resync_premium();

-- Un admin de club ne modifie ni la formule, ni les sièges, ni le créateur.
create or replace function public.clubs_freeze_billing()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if current_user = 'authenticated' and not public.is_gems_dev() then
    new.plan_tier := old.plan_tier; new.seats := old.seats; new.created_by := old.created_by;
    new.invite_code := old.invite_code; new.created_at := old.created_at;
  end if;
  return new;
end $$;
drop trigger if exists clubs_freeze_billing on public.clubs;
create trigger clubs_freeze_billing before update on public.clubs
  for each row execute function public.clubs_freeze_billing();

-- Les développeurs valident un club / changent sa formule.
create or replace function public.dev_set_club_tier(p_club uuid, p_tier text, p_seats int default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_gems_dev() then raise exception 'forbidden'; end if;
  if p_tier not in ('pending', 'club_pro', 'suspended') then raise exception 'invalid_tier'; end if;
  update public.clubs set plan_tier = p_tier, seats = coalesce(p_seats, seats) where id = p_club;
end $$;
grant execute on function public.dev_set_club_tier(uuid, text, int) to authenticated;

-- Un admin de club peut régénérer son code (fuite) — seul moyen de le changer.
create or replace function public.rotate_club_code(p_club uuid)
returns text language plpgsql security definer set search_path = public as $$
declare code text;
begin
  if not public.club_role(p_club, 'admin') then raise exception 'forbidden'; end if;
  code := upper(substr(translate(encode(gen_random_bytes(12), 'base64'), '+/=0O1Il', ''), 1, 8));
  update public.clubs set invite_code = code where id = p_club;
  return code;
end $$;
grant execute on function public.rotate_club_code(uuid) to authenticated;

-- coach_athletes : le staff d'un club ne crée qu'une demande (pending) ; l'actif passe par assign_club_coach.
drop policy if exists coach_athletes_insert on public.coach_athletes;
create or replace function public.is_listed_coach(p uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = p and role in ('coach', 'admin') and coach_available);
$$;
create policy coach_athletes_insert on public.coach_athletes for insert to authenticated with check (
  (auth.uid() = athlete_id and status = 'pending' and public.is_listed_coach(coach_id))
  or (public.is_coach() and coach_id = auth.uid() and exists (select 1 from public.coach_waitlist w where w.user_id = athlete_id))
  or (coach_id = auth.uid() and status = 'pending' and public.is_staff_of_user(athlete_id))
);

-- ── H2 : stockage — chacun n'écrit que ses propres fichiers ─────────────────
drop policy if exists "Users can upload their own avatar 1ige2ga_0" on storage.objects;
drop policy if exists "Users can upload their own avatar 1ige2ga_1" on storage.objects;
drop policy if exists "Users can upload their own avatar 1ige2ga_2" on storage.objects;
drop policy if exists profiles_own_insert on storage.objects;
drop policy if exists profiles_own_update on storage.objects;
drop policy if exists profiles_own_select on storage.objects;
create policy profiles_own_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'profiles' and (
    name = 'avatars/' || auth.uid() || '.jpg'
    or name ~ ('^coaches/' || auth.uid() || '\.(png|jpe?g|webp)$')
    or (name ~ '^clubs/[0-9a-f-]{36}\.(png|jpe?g|webp)$' and public.club_role(substring(name from 7 for 36)::uuid, 'admin'))));
create policy profiles_own_update on storage.objects for update to authenticated
  using (bucket_id = 'profiles' and (
    name = 'avatars/' || auth.uid() || '.jpg'
    or name ~ ('^coaches/' || auth.uid() || '\.')
    or (name ~ '^clubs/[0-9a-f-]{36}\.' and public.club_role(substring(name from 7 for 36)::uuid, 'admin'))))
  with check (bucket_id = 'profiles' and (
    name = 'avatars/' || auth.uid() || '.jpg'
    or name ~ ('^coaches/' || auth.uid() || '\.(png|jpe?g|webp)$')
    or (name ~ '^clubs/[0-9a-f-]{36}\.(png|jpe?g|webp)$' and public.club_role(substring(name from 7 for 36)::uuid, 'admin'))));
create policy profiles_own_select on storage.objects for select to authenticated
  using (bucket_id = 'profiles' and owner_id = auth.uid()::text);
update storage.buckets set file_size_limit = 5242880, allowed_mime_types = '{image/jpeg,image/png,image/webp}'
  where id in ('profiles', 'posts-images');
drop policy if exists "Auth upload posts-images" on storage.objects;
drop policy if exists posts_images_admin_insert on storage.objects;
create policy posts_images_admin_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'posts-images' and public.is_app_admin());

-- ── H3 : messages — expéditeur = soi, entre coach et athlète liés ───────────
drop policy if exists msg_participants on public.messages;
drop policy if exists "messages: insert own" on public.messages;
drop policy if exists messages_insert on public.messages;
drop policy if exists messages_mark_read on public.messages;
create policy messages_insert on public.messages for insert to authenticated with check (
  from_id = auth.uid() and to_id <> auth.uid() and exists (
    select 1 from public.coach_athletes ca
    where ca.status in ('active', 'pending')
      and ((ca.coach_id = auth.uid() and ca.athlete_id = to_id) or (ca.athlete_id = auth.uid() and ca.coach_id = to_id))));
create policy messages_mark_read on public.messages for update to authenticated
  using (to_id = auth.uid()) with check (to_id = auth.uid());
revoke update on public.messages from authenticated, anon;
grant update (read_at) on public.messages to authenticated;

-- ── H4 : profils — plus de lecture anonyme, plus d'exposition par demande forgée ─
drop policy if exists coaches_public_read on public.profiles;
create or replace function public.list_coaches()
returns table (id uuid, full_name text, photo_url text, coach_bio text, coach_specialties text[],
               coach_email text, coach_phone text, coach_available boolean)
language sql stable security definer set search_path = public as $$
  select id, full_name, photo_url, coach_bio, coach_specialties, coach_email, coach_phone, coach_available
  from public.profiles where role = 'coach' and coach_available;
$$;
revoke execute on function public.list_coaches() from anon, public;
grant execute on function public.list_coaches() to authenticated;

-- ── H5 : l'email du profil suit celui du compte (pas modifiable à la main) ───
create or replace function public.protect_premium_columns()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if current_user = 'authenticated' then
    new.premium_type       := old.premium_type;
    new.premium_expires_at := old.premium_expires_at;
    new.premium_cancelled  := old.premium_cancelled;
    new.premium_code       := old.premium_code;
    new.premium_months     := old.premium_months;
    new.is_premium         := old.is_premium;
    new.role               := old.role;
    new.email              := old.email;
  end if;
  return new;
end $$;

create or replace function public.dev_set_dev(p_email text, p_on boolean)
returns text language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  if not public.is_gems_dev() then raise exception 'forbidden'; end if;
  select id into v from auth.users where lower(email) = lower(trim(p_email)) and email_confirmed_at is not null;
  if v is null then return 'not_found'; end if;
  if p_on then
    insert into public.gems_devs(user_id, added_by) values (v, auth.uid()) on conflict do nothing;
  else
    if v = auth.uid() then raise exception 'cannot_remove_self'; end if;
    delete from public.gems_devs where user_id = v;
  end if;
  return 'ok';
end $$;

-- ── M1 : plans — écriture coach seulement avec une relation active ──────────
drop policy if exists "plans: owner or coach" on public.plans;
drop policy if exists coach_delete_athlete_plans on public.plans;
create policy coach_delete_athlete_plans on public.plans for delete using (
  exists (select 1 from public.coach_athletes ca where ca.coach_id = auth.uid() and ca.athlete_id = plans.user_id and ca.status = 'active'));
alter policy coach_update_athlete_plans on public.plans
  using (user_id in (select athlete_id from public.coach_athletes where coach_id = auth.uid() and status = 'active'))
  with check (user_id in (select athlete_id from public.coach_athletes where coach_id = auth.uid() and status = 'active'));

-- ── M2 : notes coach ────────────────────────────────────────────────────────
drop policy if exists notes_access on public.coach_notes;
drop policy if exists notes_read on public.coach_notes;
drop policy if exists notes_coach_write on public.coach_notes;
create policy notes_read on public.coach_notes for select using (coach_id = auth.uid() or athlete_id = auth.uid());
create policy notes_coach_write on public.coach_notes for all
  using (coach_id = auth.uid())
  with check (coach_id = auth.uid() and exists (select 1 from public.coach_athletes ca
    where ca.coach_id = auth.uid() and ca.athlete_id = coach_notes.athlete_id and ca.status = 'active'));

-- ── M3 : file d'attente — suppression réservée aux admins GEMS ──────────────
drop policy if exists coach_deletes_waitlist on public.coach_waitlist;
create policy coach_deletes_waitlist on public.coach_waitlist for delete using (public.is_app_admin());
alter policy coach_updates_waitlist on public.coach_waitlist
  using (public.is_coach()) with check (public.is_coach() and status in ('waiting', 'approved'));

-- ── M6 : codes promo — une seule fois par compte, pas lisibles ──────────────
create table if not exists public.promo_redemptions (
  user_id uuid not null references public.profiles(id) on delete cascade,
  code text not null,
  redeemed_at timestamptz not null default now(),
  primary key (user_id, code)
);
alter table public.promo_redemptions enable row level security;
drop policy if exists "Users can read active codes" on public.promo_codes;

create or replace function public.apply_promo_code_safe(p_user_id uuid, p_code text)
returns json language plpgsql security definer set search_path = public as $$
declare v_promo record;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then raise exception 'Unauthorized'; end if;
  if exists (select 1 from public.promo_redemptions where user_id = auth.uid() and code = upper(trim(p_code))) then
    return json_build_object('error', 'Code déjà utilisé');
  end if;
  update public.promo_codes set use_count = use_count + 1
   where code = upper(trim(p_code)) and active = true and (max_uses is null or use_count < max_uses)
   returning * into v_promo;
  if not found then return json_build_object('error', 'Code invalide ou expiré'); end if;
  insert into public.promo_redemptions(user_id, code) values (auth.uid(), upper(trim(p_code)));
  update public.profiles
     set premium_type = v_promo.type,
         premium_expires_at = greatest(coalesce(premium_expires_at, now()), now()) + (v_promo.months || ' months')::interval
   where id = auth.uid() and coalesce(premium_type, 'free') not in ('dev');
  return json_build_object('success', true);
end $$;
revoke execute on function public.apply_promo_code_safe(uuid, text) from anon, public;
grant execute on function public.apply_promo_code_safe(uuid, text) to authenticated;

-- ── LOW ─────────────────────────────────────────────────────────────────────
-- search_path sur les fonctions definer historiques.
alter function public.handle_new_user() set search_path = public;
alter function public.start_free_trial_safe(uuid) set search_path = public;
alter function public.protect_premium_fields() set search_path = public;
alter function public.check_plan_activation_premium() set search_path = public;
revoke execute on function public.start_free_trial_safe(uuid) from anon, public;
grant execute on function public.start_free_trial_safe(uuid) to authenticated;

-- Fonctions internes non appelables par les clients.
revoke execute on function public.club_members_sync_premium() from public, anon, authenticated;
revoke execute on function public.clubs_resync_premium() from public, anon, authenticated;

-- Membres fondateurs : chacun ne lit que sa ligne (le compteur passe par founding_spots_remaining()).
-- (appliqué après mise à jour de l'app : voir note)

-- Tickets support : l'utilisateur ne pré-remplit pas la réponse.
drop policy if exists "Users insert own tickets" on public.support_tickets;
create policy "Users insert own tickets" on public.support_tickets for insert
  with check (user_id = auth.uid() and answer is null and coalesce(status, 'open') = 'open');

-- Annonces / séances / séances à faire : auteur et coach = soi (sauf admin du club).
create or replace function public.club_staff_authorship()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if current_user = 'authenticated' then
    if tg_table_name = 'club_announcements' then
      if new.author_id is distinct from auth.uid() and not public.club_role(new.club_id, 'admin') then new.author_id := auth.uid(); end if;
    else
      if new.coach_id is not null and new.coach_id is distinct from auth.uid() and not public.club_role(new.club_id, 'admin') then
        new.coach_id := auth.uid();
      end if;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists club_staff_authorship on public.club_announcements;
create trigger club_staff_authorship before insert or update on public.club_announcements for each row execute function public.club_staff_authorship();
drop trigger if exists club_staff_authorship on public.club_sessions;
create trigger club_staff_authorship before insert or update on public.club_sessions for each row execute function public.club_staff_authorship();
drop trigger if exists club_staff_authorship on public.club_workouts;
create trigger club_staff_authorship before insert or update on public.club_workouts for each row execute function public.club_staff_authorship();

-- Le staff ne réserve que pour des membres actifs du club.
drop policy if exists bookings_staff on public.club_bookings;
create policy bookings_staff on public.club_bookings for all
  using (exists (select 1 from public.club_sessions s where s.id = session_id and public.is_club_staff(s.club_id)))
  with check (exists (select 1 from public.club_sessions s join public.club_members m on m.club_id = s.club_id
                      where s.id = session_id and public.is_club_staff(s.club_id)
                        and m.user_id = club_bookings.user_id and m.status = 'active'));

-- Compteur de visites : chemins bornés.
create or replace function public.track_page_view(p_path text)
returns void language plpgsql security definer set search_path = public as $$
declare p text;
begin
  p := left(coalesce(nullif(regexp_replace(coalesce(p_path, '/'), '\?.*$', ''), ''), '/'), 120);
  if p !~ '^/[a-zA-Z0-9/_\-.%]*$' then return; end if;
  if (select count(distinct path) from public.site_page_views where day = current_date) > 500
     and not exists (select 1 from public.site_page_views where day = current_date and path = p) then
    return;
  end if;
  insert into public.site_page_views(day, path, views) values (current_date, p, 1)
  on conflict (day, path) do update set views = site_page_views.views + 1;
end $$;

-- ============================================================================
-- V12 — Données de santé sensibles (RGPD art. 9) + petits durcissements
-- ============================================================================
-- Le suivi du cycle (règles, endométriose, SOPK, contraception) quitte plans.athlete_metrics
-- (lisible par le coach, le staff du club, les devs) pour une table lisible par l'athlète seul.
create table if not exists public.athlete_health (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  cycle      jsonb,
  updated_at timestamptz not null default now()
);
alter table public.athlete_health enable row level security;
drop policy if exists athlete_health_own on public.athlete_health;
create policy athlete_health_own on public.athlete_health for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Toute écriture de athlete_metrics.cycle dans un plan (y compris par une ancienne
-- version de l'app) est déplacée vers athlete_health et retirée du plan.
create or replace function public.plans_extract_health()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.athlete_metrics ? 'cycle' then
    insert into public.athlete_health(user_id, cycle, updated_at)
    values (new.user_id, new.athlete_metrics->'cycle', now())
    on conflict (user_id) do update set cycle = excluded.cycle, updated_at = now();
    new.athlete_metrics := new.athlete_metrics - 'cycle';
  end if;
  return new;
end $$;
revoke execute on function public.plans_extract_health() from public, anon, authenticated;
drop trigger if exists plans_extract_health on public.plans;
create trigger plans_extract_health before insert or update on public.plans
  for each row execute function public.plans_extract_health();

-- Migration des données existantes (le trigger fait le déplacement).
update public.plans set athlete_metrics = athlete_metrics where athlete_metrics ? 'cycle';

-- Champs de profil que l'utilisateur ne doit pas modifier lui-même.
create or replace function public.protect_premium_columns()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if current_user = 'authenticated' then
    new.premium_type       := old.premium_type;
    new.premium_expires_at := old.premium_expires_at;
    new.premium_cancelled  := old.premium_cancelled;
    new.premium_code       := old.premium_code;
    new.premium_months     := old.premium_months;
    new.is_premium         := old.is_premium;
    new.role               := old.role;
    new.email              := old.email;
    new.dev_mode           := old.dev_mode;
    new.gems_score         := old.gems_score;
  end if;
  return new;
end $$;

-- Retours (feedback) : tailles bornées contre le spam.
alter table public.feedback drop constraint if exists feedback_lengths;
alter table public.feedback add constraint feedback_lengths check (
  length(coalesce(message, '')) <= 4000 and length(coalesce(email, '')) <= 200
  and length(coalesce(category, '')) <= 80 and length(coalesce(situation, '')) <= 200
  and length(coalesce(age_range, '')) <= 40 and length(coalesce(niveau, '')) <= 80) not valid;

-- ============================================================================
-- V10 — Sécurité des fonctions serveur (achats, Strava, plans du coach)
-- ============================================================================
-- ═══════════════════════════════════════════════════════════════════
-- GEMS — V10 sécurité (Edge Functions)
-- À exécuter AVANT le déploiement des fonctions (Supabase Dashboard → SQL Editor).
-- Idempotent : peut être rejoué sans effet de bord.
-- ═══════════════════════════════════════════════════════════════════
-- Contenu :
--   1. app_store_transactions      — binding original_transaction_id → user_id (C1/C2)
--   2. strava_oauth_states + RPC   — nonce OAuth Strava à usage unique (H1)
--   3. plans_guard_coach_managed   — l'athlète ne modifie pas weeks/dates d'un plan coaché (H3)
--   4. strava_webhook_events       — dédoublonnage des retries Strava (M2)
-- ═══════════════════════════════════════════════════════════════════

begin;

create extension if not exists pgcrypto with schema extensions;

-- ── 1. Binding des abonnements App Store ────────────────────────────
-- Un original_transaction_id Apple (= un abonnement) ne peut débloquer qu'UN
-- compte GEMS. Écrit uniquement par verify-purchase / app-store-notifications
-- (service_role). RLS activée, AUCUNE policy client.
create table if not exists public.app_store_transactions (
  original_transaction_id text primary key,
  user_id           uuid not null references public.profiles(id) on delete cascade,
  app_account_token uuid,
  bound_via         text not null default 'verify-purchase',
  product_id        text,
  environment       text,
  last_expires_at   timestamptz,
  last_active       boolean,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists app_store_transactions_user_idx on public.app_store_transactions(user_id);
alter table public.app_store_transactions enable row level security;
revoke all on public.app_store_transactions from anon, authenticated;

-- ── 2. Nonce OAuth Strava ───────────────────────────────────────────
create table if not exists public.strava_oauth_states (
  nonce      text primary key,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  expires_at timestamptz not null
);
create index if not exists strava_oauth_states_user_idx on public.strava_oauth_states(user_id);
create index if not exists strava_oauth_states_expires_idx on public.strava_oauth_states(expires_at);
alter table public.strava_oauth_states enable row level security;
revoke all on public.strava_oauth_states from anon, authenticated;

-- Retourne un nonce (64 caractères hex, 32 octets aléatoires, TTL 10 min) à passer
-- en paramètre `state` de l'URL d'autorisation Strava. Consommé par strava-callback.
create or replace function public.create_strava_oauth_state()
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid   uuid := auth.uid();
  v_nonce text;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = 'P0001';
  end if;

  -- Purge des nonces expirés (tous utilisateurs) + plafonnement à 5 nonces actifs par utilisateur.
  delete from public.strava_oauth_states where expires_at < now();
  delete from public.strava_oauth_states
   where user_id = v_uid
     and nonce not in (
       select nonce from public.strava_oauth_states
        where user_id = v_uid order by expires_at desc limit 4);

  v_nonce := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.strava_oauth_states (nonce, user_id, expires_at)
  values (v_nonce, v_uid, now() + interval '10 minutes');
  return v_nonce;
end;
$$;

revoke all on function public.create_strava_oauth_state() from public, anon;
grant execute on function public.create_strava_oauth_state() to authenticated;

-- ── 3. Plans gérés par un coach ─────────────────────────────────────
-- Plan « coaché » = athlete_metrics.coachEdited = true, ou coachId non vide, ou
-- planType = 'coach'. Pour un tel plan, l'ATHLÈTE (rôle authenticated,
-- auth.uid() = propriétaire) ne peut pas modifier weeks / start_date / goal_date,
-- et les marqueurs coach (coachId / coachEdited / planType='coach') sont
-- conservés même si le client réécrit athlete_metrics en entier (l'app Android
-- réécrit athlete_metrics sans ces clés). Le reste (completed_sessions, pbs,
-- is_active, autres métriques) reste modifiable.
-- Coachs, staff de club, service_role (Edge Functions) et fonctions
-- SECURITY DEFINER ne sont pas concernés.
create or replace function public.plans_guard_coach_managed()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  om jsonb;
  nm jsonb;
begin
  if current_user <> 'authenticated' then
    return new;
  end if;
  if auth.uid() is distinct from old.user_id then
    return new;                           -- coach / staff : non concerné
  end if;

  om := coalesce(old.athlete_metrics::jsonb, '{}'::jsonb);
  if jsonb_typeof(om) <> 'object' then
    return new;
  end if;
  if not (
       coalesce(om -> 'coachEdited' = 'true'::jsonb, false)
    or coalesce(om ->> 'coachId', '') <> ''
    or coalesce(om ->> 'planType', '') = 'coach'
  ) then
    return new;                           -- plan non coaché
  end if;

  if new.weeks::jsonb is distinct from old.weeks::jsonb
     or new.start_date is distinct from old.start_date
     or new.goal_date  is distinct from old.goal_date then
    raise exception 'COACH_MANAGED'
      using errcode = 'P0001',
            hint = 'Ce plan est géré par ton coach : seules ses modifications sont autorisées.';
  end if;

  -- Conserve les marqueurs coach.
  nm := coalesce(new.athlete_metrics::jsonb, '{}'::jsonb);
  if jsonb_typeof(nm) <> 'object' then nm := '{}'::jsonb; end if;
  if om ? 'coachId'     then nm := jsonb_set(nm, '{coachId}',     om -> 'coachId');     end if;
  if om ? 'coachEdited' then nm := jsonb_set(nm, '{coachEdited}', om -> 'coachEdited'); end if;
  if om ->> 'planType' = 'coach' then nm := jsonb_set(nm, '{planType}', om -> 'planType'); end if;
  if nm is distinct from coalesce(new.athlete_metrics::jsonb, '{}'::jsonb) then
    new.athlete_metrics := nm;
  end if;

  return new;
end;
$$;

drop trigger if exists plans_guard_coach_managed on public.plans;
create trigger plans_guard_coach_managed
  before update on public.plans
  for each row execute function public.plans_guard_coach_managed();

-- ── 4. Dédoublonnage des events Strava ──────────────────────────────
-- Strava rejoue un event non acquitté (jusqu'à 3 fois) : on supprime les
-- doublons existants puis on pose l'index unique utilisé par strava-webhook
-- (insert → 23505 ignoré).
delete from public.strava_webhook_events a
 using public.strava_webhook_events b
 where a.user_id     = b.user_id
   and a.activity_id = b.activity_id
   and a.aspect_type = b.aspect_type
   and a.event_time  = b.event_time
   and (coalesce(a.processed, false)::int < coalesce(b.processed, false)::int
        or (coalesce(a.processed, false) = coalesce(b.processed, false) and a.ctid > b.ctid));

create unique index if not exists strava_webhook_events_dedupe
  on public.strava_webhook_events (user_id, activity_id, aspect_type, event_time);

commit;

-- ── Vérifications (lecture seule) ───────────────────────────────────
-- select relname, relrowsecurity from pg_class where relname in ('app_store_transactions','strava_oauth_states');
-- select tgname from pg_trigger where tgrelid = 'public.plans'::regclass and tgname = 'plans_guard_coach_managed';
-- select indexname from pg_indexes where indexname = 'strava_webhook_events_dedupe';
-- select has_function_privilege('authenticated', 'public.create_strava_oauth_state()', 'execute');  -- true
-- select has_function_privilege('anon', 'public.create_strava_oauth_state()', 'execute');           -- false

-- V12 bis — rotate_club_code : gen_random_bytes est dans le schéma extensions.
alter function public.rotate_club_code(uuid) set search_path = public, extensions;

-- Après déploiement du site (inscription sans vérification anonyme) :
revoke execute on function public.check_coach_code(text) from anon, public;
grant execute on function public.check_coach_code(text) to authenticated;
