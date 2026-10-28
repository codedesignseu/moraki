begin;
create extension if not exists pgtap with schema extensions;
select plan(3);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000001', 'a@example.test');

select is(public.terms_version(), '2026-10-28', 'the Terms in force are dated 28 October 2026');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';

select public.record_consent('terms', '2026-10-24', 'grant');
select is(public.has_terms(), false, 'agreeing to the 24 October Terms no longer counts');

select public.record_consent('terms', '2026-10-28', 'grant');
select is(public.has_terms(), true, 'agreeing to the 28 October Terms counts');

select * from finish();
rollback;
