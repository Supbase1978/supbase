-- ============================================================================
-- CORE — user_consents (verziózott beleegyezés-napló, F1.8). CSAK core-migráció
-- nyúlhat hozzá (1.3). Idempotens, additív.
--
-- Terv (jövőállóság): NEM fix „elfogadtad?" oszlop a profiles-on, hanem
-- append-only naplósorok `(user_id, kind, version, granted_at)`. Így:
--   * új beleegyezés-fajta (pl. marketing, harmadik fél) = új `kind`, séma-
--     módosítás nélkül (a CHECK bővíthető, de a 'marketing' már most engedett);
--   * a jogi szöveg lényeges változásakor a `version` emelésével a meglévő
--     userek újra-elfogadásra kérhetők (a régi verzióra adott consent megmarad,
--     audit-nyom marad);
--   * a GDPR-export/-törlés természetesen soronként kezelhető.
-- ============================================================================

create table if not exists public.user_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  kind text not null check (kind in ('terms', 'privacy', 'marketing')),
  version text not null,
  granted_at timestamptz not null default now(),
  -- Egy user egy adott fajta+verzióra egyszer (idempotens re-consent).
  unique (user_id, kind, version)
);

create index if not exists user_consents_user_idx on public.user_consents (user_id);

alter table public.user_consents enable row level security;

-- ---------------------------------------------------------------------------
-- RLS-policyk. Append-only: a user CSAK a saját beleegyezését szúrhatja be és
-- olvashatja; nincs user-oldali UPDATE/DELETE (a napló nem módosítható). Admin
-- mindent lát és törölhet (GDPR-adminisztráció).
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='user_consents' and policyname='user_consents_select_own_or_admin') then
    create policy user_consents_select_own_or_admin on public.user_consents
      for select to authenticated using (user_id = auth.uid() or public.is_admin());
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='user_consents' and policyname='user_consents_insert_own') then
    create policy user_consents_insert_own on public.user_consents
      for insert to authenticated with check (user_id = auth.uid());
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='user_consents' and policyname='user_consents_delete_admin') then
    create policy user_consents_delete_admin on public.user_consents
      for delete to authenticated using (public.is_admin());
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Signup-consent rögzítése a metaadatból (definer, RLS-t megkerül). Az
-- e-mail-megerősítéses flow miatt regisztrációkor nincs aktív session, ezért a
-- consent-szándékot a `raw_user_meta_data.consent_version` hordozza, és a user
-- létrejöttekor íródik naplóba — atomikusan, mint a profil (handle_new_user).
--
-- Trigger-sorrend: a név ábécében a `on_auth_user_created` (profil) UTÁN áll,
-- így a profiles-sor már létezik, amikor a consent FK-ra hivatkozik.
-- ---------------------------------------------------------------------------
create or replace function public.record_signup_consents()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v text := nullif(new.raw_user_meta_data ->> 'consent_version', '');
begin
  if v is not null then
    insert into public.user_consents (user_id, kind, version)
    values (new.id, 'terms', v), (new.id, 'privacy', v)
    on conflict (user_id, kind, version) do nothing;

    if (new.raw_user_meta_data ->> 'consent_marketing') = 'true' then
      insert into public.user_consents (user_id, kind, version)
      values (new.id, 'marketing', v)
      on conflict (user_id, kind, version) do nothing;
    end if;
  end if;
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'on_auth_user_created_consents' and not tgisinternal
  ) then
    create trigger on_auth_user_created_consents
      after insert on auth.users
      for each row execute function public.record_signup_consents();
  end if;
end $$;
