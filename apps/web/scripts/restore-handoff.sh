#!/usr/bin/env bash
# Restores Nick's database dump (db/mentorful_handoff.sql) into OUR Supabase project, then applies the scripts the dump
# lacks or that we added. Read the guards below: it refuses anything that is not the empty mentorful-app project.
#
#   scripts/restore-handoff.sh                 restore into an empty project and apply 014, 015, 016
#   scripts/restore-handoff.sh --make-admin EMAIL   after signing that person up in Supabase Auth, give them an admin profile
#
# Needs psql 17.6 or newer (brew install libpq) and DATABASE_URL (Session pooler URI) in apps/web/.env.local.
set -euo pipefail
cd "$(dirname "$0")/.."

PSQL="${PSQL:-/opt/homebrew/opt/libpq/bin/psql}"
[ -x "$PSQL" ] || PSQL="$(command -v psql || true)"
[ -n "$PSQL" ] || { echo "psql not found. Run: brew install libpq"; exit 1; }

URL="$(grep -E '^DATABASE_URL=' .env.local 2>/dev/null | head -1 | cut -d= -f2- | sed 's/^"//; s/"$//')"
case "$URL" in
  ""|PASTE_*) echo "Fill in DATABASE_URL in apps/web/.env.local first (Supabase > Connect > Session pooler)."; exit 1 ;;
  *kxcjmsqjogaoaiazucsk*) echo "Refusing: that is Nick's live project."; exit 1 ;;
  *yvdvrhxnycnzinqgnlok*) ;;
  *) echo "Refusing: this connection string is not for the mentorful-app project (yvdvrhxnycnzinqgnlok)."; exit 1 ;;
esac
run() { "$PSQL" "$URL" -X -q -v ON_ERROR_STOP=1 "$@"; }

if [ "${1:-}" = "--make-admin" ]; then
  EMAIL="${2:?usage: --make-admin EMAIL}"
  run -v email="$EMAIL" <<'SQL'
with u as (select id, email from auth.users where lower(email) = lower(:'email'))
insert into public.profiles (id, school_id, first_name, last_name, email, role, auth_user_id, onboarding_complete)
select gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', initcap(split_part(split_part(u.email, '@', 1), '.', 1)),
       initcap(split_part(split_part(u.email, '@', 1), '.', 2)), u.email, 'admin', u.id, true
  from u
 where not exists (select 1 from public.profiles p where p.auth_user_id = u.id);
select first_name, last_name, email, role from public.profiles where lower(email) = lower(:'email');
SQL
  exit 0
fi

echo "Checking the project is empty..."
N="$(run -t -A -c "select count(*) from information_schema.tables where table_schema = 'public'")"
[ "$N" = "0" ] || { echo "Refusing: the public schema already has $N tables. This script only restores into an empty project."; exit 1; }

TMP="$(mktemp)"; trap 'rm -f "$TMP"' EXIT
# The project already has a public schema; the dump tries to create it.
grep -v -e '^CREATE SCHEMA public;' -e '^COMMENT ON SCHEMA public' db/mentorful_handoff.sql > "$TMP"

echo "Restoring db/mentorful_handoff.sql (one transaction: all or nothing)..."
run --single-transaction -f "$TMP"
for f in 014_conversation_log_count 015_participation_summary 016_conversation_activity; do
  echo "Applying scripts/$f.sql ..."
  run -f "scripts/$f.sql"
done
run -c "notify pgrst, 'reload schema'"

echo "Done. Row counts:"
run -c "select 'schools' t, count(*) from schools union all select 'profiles', count(*) from profiles union all select 'cycles', count(*) from cycles union all select 'pairings', count(*) from pairings union all select 'conversation_logs', count(*) from conversation_logs union all select 'survey_responses', count(*) from survey_responses union all select 'invites', count(*) from invites"
