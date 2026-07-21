-- PHÉNIX 360 — Espace client par LIEN + CODE (M7.1, lecture seule)
-- ============================================================================
-- Le client n'a PAS de compte : il ouvre un lien vers SON chantier et saisit un
-- code que le conducteur lui a communiqué. Le code est vérifié CÔTÉ SERVEUR (pas
-- dans le navigateur) par une fonction SECURITY DEFINER ; sans le bon code, rien
-- n'est renvoyé. La fonction ne renvoie QUE ce qui est visible au client (miroir
-- exact de `isVisibleToClient` / `event_select_client`).
--
-- Modèle de menace : le code protège une VUE en lecture d'un chantier (comme un
-- mot de passe wifi). Il est stocké HACHÉ (pgcrypto/bcrypt) dans une table sans
-- policy (donc illisible par `anon`/`authenticated` en direct) ; seules les
-- fonctions définies ici y accèdent. L'écriture côté client (répondre, valider)
-- viendra dans une tranche ultérieure (M7.2), via des RPC également code-gardées.

create extension if not exists pgcrypto;

create table if not exists project_client_access (
  project_id uuid primary key references project(id) on delete cascade,
  code_hash  text not null,
  updated_at timestamptz not null default now()
);
-- RLS active SANS aucune policy : la table n'est accessible qu'aux fonctions
-- SECURITY DEFINER ci-dessous (jamais lisible en direct par un client).
alter table project_client_access enable row level security;

-- Le CONDUCTEUR (membre interne) fixe / met à jour le code d'accès de SON chantier.
create or replace function set_client_access(p_project uuid, p_code text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not app_is_internal(p_project) then
    raise exception 'forbidden: not internal member' using errcode = '42501';
  end if;
  if length(coalesce(p_code, '')) < 4 then
    raise exception 'code too short' using errcode = '22023';
  end if;
  insert into project_client_access (project_id, code_hash)
  values (p_project, crypt(p_code, gen_salt('bf')))
  on conflict (project_id)
    do update set code_hash = excluded.code_hash, updated_at = now();
end;
$$;
grant execute on function set_client_access(uuid, text) to authenticated;

-- Le CLIENT (anonyme) récupère SON espace avec le code. Renvoie le chantier et
-- les événements visibles au client (récit, documents, décisions, demandes) —
-- rien d'autre. Mauvais code ⇒ exception (aucune donnée ne fuit).
create or replace function client_space(p_project uuid, p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash   text;
  v_result jsonb;
begin
  select code_hash into v_hash from project_client_access where project_id = p_project;
  if v_hash is null or v_hash <> crypt(p_code, v_hash) then
    raise exception 'forbidden: bad code' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'project',
    (
      select to_jsonb(p)
      from (
        select id, code, name, address, status, current_step, created_at
        from project where id = p_project
      ) p
    ),
    'events',
    coalesce(
      (
        select jsonb_agg(to_jsonb(e) order by e.created_at)
        from (
          select id, project_id, type, author_id, author_role, visibility, state,
                 capture_id, created_at, published_by, published_at, content
          from event
          where project_id = p_project
            and visibility = 'client'
            and (
              case
                when type = 'demande' then (
                  case
                    when (content ->> 'destinataire') = 'client'
                      then state in ('ouverte', 'traitee', 'close')
                    else state in ('traitee', 'close')
                  end
                )
                else state = 'publie'
              end
            )
        ) e
      ),
      '[]'::jsonb
    )
  )
  into v_result;

  return v_result;
end;
$$;
grant execute on function client_space(uuid, text) to anon, authenticated;
