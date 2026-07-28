-- ============================================================================
-- CORE: fejlesztői visszajelzés-csatorna (F2.2).
--
-- MIRE VALÓ: a felhasználó hibát jelenthet, hiányzó BESZERZÉSI HELYET vagy
-- DESZKA-MODELLT javasolhat. A tartalom NEM publikus és nem jelenik meg
-- sehol a felületen: kizárólag az adminhoz jut el (RLS: olvasni csak admin
-- tud). A katalógus-javaslatok így a catalog-watch moderációjának emberi
-- párját adják — amit a figyelő nem talál meg, azt a közösség jelezheti.
--
-- ÍRÁS: csak BEJELENTKEZETT, megerősített e-mailű felhasználó, és kizárólag a
-- SAJÁT nevében (`user_id = auth.uid()`). Ez tudatos szigor: a PecApp-ban egy
-- hitelesítés nélküli visszajelzés-végpont levélbombázható volt és a levelező
-- kvótát ürítette. A gyakoriság-korlátot a route-réteg adja (óránkénti darab),
-- a mennyiségi korlátokat pedig itt, kényszerekben rögzítjük.
--
-- SZEMÉLYES ADAT: a szöveg mezőbe nem kérünk elérhetőséget — a válaszhoz a
-- `user_id` elég. A GDPR-anonimizálás a profil-hivatkozást bontja
-- (`on delete set null`), a beküldött szöveg pedig attól kezdve névtelen.
-- ============================================================================

create table if not exists public.feedback (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  user_id uuid references public.profiles on delete set null,
  -- Mire vonatkozik: hiba · hiányzó bolt · hiányzó deszka · ötlet · egyéb.
  kind text not null check (kind in ('bug', 'shop', 'board', 'idea', 'other')),
  message text not null,
  -- Melyik oldalról küldték (query NÉLKÜL, az analytics-szabály szerint: a
  -- deszkaválasztó megosztható linkje testsúlyt és magasságot tartalmaz).
  page_path text,
  -- Feldolgozottsági állapot — az admin listája ezzel szűr.
  status text not null default 'new'
    check (status in ('new', 'in_progress', 'done', 'rejected')),
  admin_note text,
  handled_by uuid references public.profiles,
  handled_at timestamptz
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'feedback_message_check') then
    -- Alsó korlát: az egy szavas „hiba" használhatatlan. Felső korlát: a mező
    -- visszajelzésre való, nem adatfeltöltésre.
    alter table public.feedback add constraint feedback_message_check
      check (char_length(message) between 10 and 4000);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'feedback_path_check') then
    alter table public.feedback add constraint feedback_path_check
      check (page_path is null or page_path ~ '^/[A-Za-z0-9/_.\-]{0,120}$');
  end if;

  if not exists (select 1 from pg_constraint where conname = 'feedback_note_check') then
    alter table public.feedback add constraint feedback_note_check
      check (admin_note is null or char_length(admin_note) <= 2000);
  end if;
end $$;

create index if not exists feedback_status_idx on public.feedback (status, created_at desc);
create index if not exists feedback_user_idx on public.feedback (user_id, created_at desc);

alter table public.feedback enable row level security;

do $$
begin
  -- ÍRÁS: bejelentkezett + megerősített e-mail, csak saját néven. A `status`
  -- és az admin-mezők ellen a lenti trigger véd (a beküldő nem állíthatja
  -- magát „kész"-re, és nem írhat admin-jegyzetet).
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'feedback'
      and policyname = 'feedback_insert_own'
  ) then
    create policy feedback_insert_own on public.feedback
      for insert to authenticated
      with check (user_id = auth.uid() and public.is_email_confirmed());
  end if;

  -- OLVASÁS: CSAK admin. A beküldő sem olvashatja vissza a listát — a
  -- csatorna a fejlesztőnek szól, nem közösségi felület.
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'feedback'
      and policyname = 'feedback_admin_read'
  ) then
    create policy feedback_admin_read on public.feedback
      for select to authenticated using (public.is_admin());
  end if;

  -- ÁLLAPOT-KEZELÉS: csak admin.
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'feedback'
      and policyname = 'feedback_admin_update'
  ) then
    create policy feedback_admin_update on public.feedback
      for update to authenticated using (public.is_admin()) with check (public.is_admin());
  end if;
  -- Szándékosan NINCS delete-policy: a visszajelzés napló, nem törölhető
  -- REST-ről (a GDPR-törlés a user_id-t bontja, a sort nem viszi el).
end $$;

-- ---------------------------------------------------------------------------
-- Oszlop-védelem: a beküldő nem állíthat állapotot/admin-mezőt (a többi
-- védett táblánál használt trigger-minta — providers, board_reviews).
-- ---------------------------------------------------------------------------
create or replace function public.protect_feedback_columns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if not public.is_admin() then
      new.status := 'new';
      new.admin_note := null;
      new.handled_by := null;
      new.handled_at := null;
    end if;
  elsif tg_op = 'UPDATE' then
    if not public.is_admin() then
      new.status := old.status;
      new.admin_note := old.admin_note;
      new.handled_by := old.handled_by;
      new.handled_at := old.handled_at;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_feedback_columns on public.feedback;
create trigger protect_feedback_columns
  before insert or update on public.feedback
  for each row execute function public.protect_feedback_columns();

-- ---------------------------------------------------------------------------
-- Gyakoriság-korlát: felhasználónként óránként 5 visszajelzés.
--
-- Miért az ADATBÁZISBAN? Mert a beküldő a saját sorait sem olvashatja vissza
-- (admin-only select), tehát az alkalmazás nem tudná megszámolni őket; és mert
-- így a korlát a REST-en át is él, nem csak a mi űrlapunkon. A definer-jogkör
-- kizárólag a számláláshoz kell. Az üzenet tartalmazza a `feedback_rate_limit`
-- jelzést, amit az alkalmazás barátságos üzenetre fordít.
-- ---------------------------------------------------------------------------
create or replace function public.enforce_feedback_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  recent_count int;
begin
  if public.is_admin() then
    return new;
  end if;
  select count(*) into recent_count
    from public.feedback
   where user_id = new.user_id
     and created_at > now() - interval '1 hour';
  if recent_count >= 5 then
    raise exception 'feedback_rate_limit: óránként legfeljebb 5 visszajelzés küldhető';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_feedback_rate_limit on public.feedback;
create trigger enforce_feedback_rate_limit
  before insert on public.feedback
  for each row execute function public.enforce_feedback_rate_limit();

comment on table public.feedback is
  'Fejlesztői visszajelzés-csatorna (hiba / hiányzó bolt / hiányzó deszka / ötlet). NEM publikus: olvasni csak admin tud.';
