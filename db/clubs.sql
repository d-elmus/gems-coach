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
