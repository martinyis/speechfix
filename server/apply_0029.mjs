import 'dotenv/config';
import postgres from 'postgres';
import fs from 'fs';
const sql = postgres(process.env.DATABASE_URL, { max: 1 });
let migration = fs.readFileSync('./drizzle/0029_pressure_drill_sessions.sql', 'utf8');
// Strip BEGIN/COMMIT — we'll use sql.begin() instead
migration = migration.replace(/^\s*BEGIN\s*;/mi, '').replace(/^\s*COMMIT\s*;/mi, '');
console.log('Applying migration 0029_pressure_drill_sessions.sql...');
await sql.begin(async (tx) => {
  await tx.unsafe(migration);
});
console.log('Done.');
const rows = await sql`SELECT to_regclass('pressure_drill_sessions') AS t, to_regclass('filler_coach_sessions') AS old`;
console.log('Post-migration:', rows[0]);
const cols = await sql`SELECT column_name FROM information_schema.columns WHERE table_name='pressure_drill_sessions' ORDER BY ordinal_position`;
console.log('Columns:', cols.map(c => c.column_name).join(', '));
await sql.end();
