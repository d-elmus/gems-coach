-- ============================================================================
-- GEMS — Accès coach à la file d'attente générale (coach_waitlist)
-- ----------------------------------------------------------------------------
-- Permet à un compte coach (profiles.role IN ('coach','admin')) de :
--   1. VOIR toutes les personnes en attente de coaching (coach_waitlist.waiting)
--   2. LIRE leur profil (nom, email, photo) pour les afficher dans le dashboard
--   3. Les ACCEPTER : créer la relation coach_athletes en 'active'
--   4. Marquer/retirer leur ligne de file (update 'approved' / delete)
--
-- À exécuter dans Supabase → SQL Editor. Idempotent (rejouable sans risque).
-- Sa place « propre » est le repo gems-backend ; posé ici avec la feature coach.
-- ============================================================================

-- Helper : l'utilisateur courant est-il un coach ?
create or replace function public.is_coach()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('coach', 'admin')
  );
$$;

-- ── coach_waitlist ──────────────────────────────────────────────────────────
alter table public.coach_waitlist enable row level security;

-- Un coach voit toute la file d'attente.
drop policy if exists "coach_reads_waitlist" on public.coach_waitlist;
create policy "coach_reads_waitlist" on public.coach_waitlist
  for select using (public.is_coach());

-- Un coach peut marquer une ligne comme traitée (status -> 'approved').
drop policy if exists "coach_updates_waitlist" on public.coach_waitlist;
create policy "coach_updates_waitlist" on public.coach_waitlist
  for update using (public.is_coach()) with check (public.is_coach());

-- Un coach peut retirer quelqu'un de la file (Ignorer).
drop policy if exists "coach_deletes_waitlist" on public.coach_waitlist;
create policy "coach_deletes_waitlist" on public.coach_waitlist
  for delete using (public.is_coach());

-- ── profiles ────────────────────────────────────────────────────────────────
-- Un coach peut lire le profil des athlètes en attente (pour les afficher).
alter table public.profiles enable row level security;

drop policy if exists "coach_reads_waitlisted_profiles" on public.profiles;
create policy "coach_reads_waitlisted_profiles" on public.profiles
  for select using (
    public.is_coach()
    and id in (select user_id from public.coach_waitlist where status = 'waiting')
  );

-- ── coach_athletes ──────────────────────────────────────────────────────────
-- Un coach peut créer la relation quand il accepte quelqu'un de la file
-- (jusqu'ici seul l'athlète insérait la ligne 'pending' en choisissant son coach).
alter table public.coach_athletes enable row level security;

drop policy if exists "coach_inserts_own_relation" on public.coach_athletes;
create policy "coach_inserts_own_relation" on public.coach_athletes
  for insert with check (public.is_coach() and coach_id = auth.uid());
