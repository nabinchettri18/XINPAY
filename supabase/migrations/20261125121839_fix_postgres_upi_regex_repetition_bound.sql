-- PostgreSQL regex repetition bounds are limited to 255.
-- Keep all persisted UPI/VPA validation aligned with that limit.
DO $fix$
DECLARE
  fn record;
  definition text;
BEGIN
  FOR fn IN
    SELECT p.oid
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname IN ('public','private')
      AND p.prokind = 'f'
      AND pg_get_functiondef(p.oid) LIKE '%{2,256}%'
  LOOP
    definition := replace(pg_get_functiondef(fn.oid), '{2,256}', '{2,255}');
    EXECUTE definition;
  END LOOP;
END;
$fix$;
