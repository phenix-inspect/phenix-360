-- PHÉNIX 360 — Temps réel (M6) : diffuser les changements du journal
-- ============================================================================
-- Le conducteur voit les écritures des AUTRES appareils (réponse du client à une
-- question, validation d'un choix) SANS recharger. Supabase Realtime diffuse les
-- changements des tables inscrites à la publication `supabase_realtime`, en
-- APPLIQUANT la RLS de l'abonné : chaque conducteur ne reçoit que les événements
-- de SES chantiers (miroir exact de la vue déjà en place).
--
-- On inscrit `event` à la publication. `replica identity full` garantit que les
-- lignes UPDATE (une demande passée à « traitee ») portent toutes leurs colonnes
-- dans le flux et que la RLS s'évalue correctement.
--
-- Idempotent ET sans danger sur un Postgres nu (hors Supabase) : si la
-- publication `supabase_realtime` n'existe pas (cas des tests locaux), on ne fait
-- rien. La RLS reste l'unique garde de visibilité — le temps réel n'ouvre aucune
-- donnée nouvelle, il accélère seulement sa livraison.

alter table event replica identity full;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'event'
     )
  then
    alter publication supabase_realtime add table event;
  end if;
end
$$;
