-- PHÉNIX 360 — Bootstrap membre par fonction sécurisée (contourne l'anomalie RLS)
-- ============================================================================
-- L'insertion directe du membre créateur sous RLS échoue de façon inexpliquée
-- (WITH CHECK refusé alors que la condition est prouvée vraie). On fournit une
-- fonction SECURITY DEFINER qui VÉRIFIE la propriété puis insère — elle s'exécute
-- avec les droits du propriétaire (postgres) et n'est donc pas soumise au WITH
-- CHECK de la table. Sûr : refuse si l'appelant n'est pas le créateur du projet.
-- C'est aussi la primitive propre pour la production (rattachement atomique).

create or replace function app_add_self_as(p_project uuid, p_role member_role)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from project where id = p_project and created_by = auth.uid()) then
    raise exception 'forbidden: not project owner' using errcode = '42501';
  end if;
  insert into project_member (project_id, user_id, role)
  values (p_project, auth.uid(), p_role)
  on conflict (project_id, user_id) do nothing;
end;
$$;

grant execute on function app_add_self_as(uuid, member_role) to authenticated;
