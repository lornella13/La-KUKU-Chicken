# Database security tests

These SQL files let you re-verify the authorization model after any schema
change. **Nothing here is shipped to the browser** — it is not referenced by any
frontend file and is not part of the Vite build.

| File | Purpose |
|---|---|
| `local_stub.sql` | Creates the Supabase-managed objects the migrations depend on (`auth.users`, `auth.uid()`, the `anon`/`authenticated`/`service_role` roles, a minimal `storage` schema). **Test-only** — never run this on your real Supabase project, which already has all of these. |
| `security_tests.sql` | 62 assertions covering constraints, promotion integrity, price arithmetic, visibility, RLS for anon/customer/staff, revocation, audit logging and bucket configuration. Applies Supabase's default table grants first, then a PG14 view shim if needed, then prints a pass/fail summary. |

## Running them locally

The only requirement is PostgreSQL 14+ and the migrations applied.

```bash
# 1. A throwaway cluster (no sudo needed)
initdb -D /tmp/pgdata -U tester --auth=trust
pg_ctl -D /tmp/pgdata -o "-p 55432 -k /tmp" -l /tmp/pg.log start

# 2. Database + Supabase stand-ins
psql -h /tmp -p 55432 -U tester -d postgres -c "create database lakuku"
psql -h /tmp -p 55432 -U tester -d lakuku -f supabase/tests/local_stub.sql

# 3. The real migrations, in order
for f in supabase/migrations/000{1,2,3,4,5}*.sql; do
  psql -h /tmp -p 55432 -U tester -d lakuku -v ON_ERROR_STOP=1 -f "$f"
done

# 4. The tests
psql -h /tmp -p 55432 -U tester -d lakuku -f supabase/tests/security_tests.sql
```

Expect `62 passed, 0 failed`. Last verified on PostgreSQL 14.24.

## Two notes

**`security_invoker` needs PostgreSQL 15+.** Both `0002` and `0005` define
`public_products` with `with (security_invoker = true)`, which is what stops the
view from bypassing RLS. Supabase runs PostgreSQL 15/17, so this is correct in
production.

On PostgreSQL 14 those two statements fail with
`unrecognized parameter "security_invoker"`, and everything *after* that
statement in the file is skipped. All the policies are still created — only the
view is missing. `security_tests.sql` detects this and creates an equivalent
test-only view, so the suite passes on 14 anyway. Nothing needs doing on
Supabase.

## A caution about testing RLS

An UPDATE that matches no permitted row affects **zero rows** — Postgres does
**not** raise an error. Asserting "this statement throws" therefore passes even
against a wide-open policy, and is not a valid security test.

This suite uses `t_expect_value()`, which runs the statement and then verifies
the data is genuinely unchanged. Use that, not "expect an error", for
`UPDATE`, `DELETE` and `SELECT` against a restricted table. INSERT is the one
case that reliably raises.