import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
// Optional isolated validation dependency; see docs/PUBLIC_REVIEWS_SETUP.md.
const { PGlite } = await import(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const db = new PGlite();
try {
  await db.exec('create role anon; create role authenticated; grant usage on schema public to anon, authenticated;');
  await db.exec(readFileSync(new URL('../supabase/project-reviews.sql', import.meta.url), 'utf8'));
  await db.exec('set role anon;');
  await db.query("insert into project_reviews (project_id,author,body,rating) values ('revere','Guest','Works well',5), ('revere','Visitor','',3), ('cosmos','Guest','Comment only',null)");
  const stats = (await db.query("select * from project_review_stats where project_id='revere'")).rows[0];
  assert.equal(Number(stats.average_rating), 4); assert.equal(Number(stats.rating_count), 2); assert.equal(Number(stats.review_count), 2);
  assert.equal((await db.query("select rating from project_reviews where project_id='cosmos'")).rows[0].rating, null);
  for (const sql of [
    "insert into project_reviews (project_id,author,body,rating) values ('revere','Guest','',null)",
    "insert into project_reviews (project_id,author,body) values ('revere','Guest',E'\\n\\t')",
    "insert into project_reviews (project_id,author,body) values ('revere',repeat('a',61),'Too long a name')",
    "insert into project_reviews (project_id,author,body) values ('revere',E'\\t','Whitespace name')",
    "insert into project_reviews (project_id,author,body,rating) values ('revere','Guest','Invalid',6)",
    "insert into project_reviews (project_id,author,body) values ('revere','Guest',repeat('a',2001))",
    "insert into project_reviews (project_id,author,body) values ('../bad','Guest','Invalid')",
    "insert into project_reviews (project_id,author,body) values ('revere',' Guest ','Invalid')",
    "insert into project_reviews (id,project_id,author,body) values (gen_random_uuid(),'revere','Guest','Forged')",
    "insert into project_reviews (created_at,project_id,author,body) values ('2000-01-01','revere','Guest','Forged')",
    "update project_reviews set rating=1", "delete from project_reviews",
  ]) await assert.rejects(db.exec(sql), 'Anonymous mutation violates a constraint or privilege');
  assert.equal((await db.query('select * from project_reviews')).rows.length, 3);
  console.log('PASS actual PostgreSQL schema, RLS roles, full aggregates, bounds and column-scoped append-only access');
} finally { await db.close(); }
