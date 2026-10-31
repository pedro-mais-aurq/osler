-- Verified Google users may deliberately choose their teaching role.
create table private.portal_preferences(user_id uuid primary key references auth.users(id) on delete cascade, role text not null check(role in ('student','teacher')), subject text not null default '' check(length(subject)<=160));
alter table private.portal_preferences enable row level security;
revoke all on private.portal_preferences from public,anon,authenticated;
grant all on private.portal_preferences to service_role;
create or replace function private.teacher_id() returns uuid language sql stable security definer set search_path='' as $$
select p.user_id from public.profiles p where p.user_id=auth.uid() and private.google_email() is not null and (p.role='teacher' or (p.role='admin' and exists(select 1 from public.admins a where a.user_id=p.user_id)));
$$;
create or replace function private.teaching_bootstrap() returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_email text := private.google_email(); v_role public.app_role; v_name text;
begin
  if auth.uid() is null or v_email is null then raise exception 'Entre com uma conta Google com e-mail confirmado.' using errcode = '42501'; end if;
  -- Serialize bootstrap calls from the shell and the page during OAuth recovery.
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 731));
  if exists(select 1 from public.admins where user_id = auth.uid()) then v_role := 'admin';
  elsif (select role from private.portal_preferences where user_id=auth.uid()) = 'student' then v_role := 'student';
  elsif coalesce((select role from private.portal_preferences where user_id=auth.uid()),'student') = 'teacher' or exists(select 1 from private.teacher_allowlist where email = v_email and enabled) then v_role := 'teacher';
  else v_role := 'student'; end if;
  update public.profiles set role = v_role where user_id = auth.uid();
  if v_role = 'teacher' then insert into public.teachers(user_id) values(auth.uid()) on conflict do nothing; end if;
  if v_role = 'student' then
    insert into public.students(user_id) values(auth.uid()) on conflict do nothing;
    update public.classroom_enrollments set student_id = auth.uid(), status = 'active'
      where email = v_email and status <> 'revoked' and (student_id is distinct from auth.uid() or status <> 'active');
  end if;
  -- A display name is cosmetic only. It never grants permissions.
  select coalesce(nullif(left(raw_user_meta_data->>'full_name',120),''),split_part(v_email,'@',1)) into v_name from auth.users where id = auth.uid();
  return jsonb_build_object('userId',auth.uid(),'email',v_email,'displayName',v_name,'role',v_role,'subject',coalesce((select subject from private.portal_preferences where user_id=auth.uid()),''));
end $$;


create function private.select_portal_role(p_role text) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or private.google_email() is null then raise exception 'Entre com Google.' using errcode='42501'; end if;
 if p_role not in ('student','teacher') or p_role is null then raise exception 'Perfil inválido.' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,731));
 insert into private.portal_preferences(user_id,role) values(auth.uid(),p_role) on conflict(user_id) do update set role=excluded.role;
 return private.teaching_bootstrap();
end $$;
create function public.select_portal_role(p_role text) returns jsonb language sql security invoker set search_path='' as $$ select private.select_portal_role(p_role); $$;
create function private.teaching_set_subject(p_subject text) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform private.require_teacher();
 if p_subject is null or length(btrim(p_subject))>160 or btrim(p_subject)='' then raise exception 'Informe a matéria lecionada (até 160 caracteres).' using errcode='22023'; end if;
 insert into private.portal_preferences(user_id,role,subject) values(auth.uid(),'teacher',btrim(p_subject)) on conflict(user_id) do update set subject=excluded.subject;
 return private.teaching_bootstrap();
end $$;
create function public.teaching_set_subject(p_subject text) returns jsonb language sql security invoker set search_path='' as $$ select private.teaching_set_subject(p_subject); $$;
revoke all on function private.select_portal_role(text),public.select_portal_role(text),private.teaching_set_subject(text),public.teaching_set_subject(text) from public,anon,authenticated;
grant execute on function private.select_portal_role(text),public.select_portal_role(text),private.teaching_set_subject(text),public.teaching_set_subject(text) to authenticated;
notify pgrst,'reload schema';
