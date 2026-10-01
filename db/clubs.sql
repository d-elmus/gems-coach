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
