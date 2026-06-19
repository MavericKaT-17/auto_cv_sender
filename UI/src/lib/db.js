import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import fs from 'fs/promises';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'storage', 'database.db');
const DB_DIR = path.dirname(DB_PATH);

let dbPromise;

export async function getDB() {
  await fs.mkdir(DB_DIR, { recursive: true });

  if (!dbPromise) {
    dbPromise = open({
      filename: DB_PATH,
      driver: sqlite3.Database,
    });
  }

  return dbPromise;
}

export async function initDB() {
  const db = await getDB();
  await db.exec(`
    CREATE TABLE IF NOT EXISTS applications (
      internal_job_id TEXT PRIMARY KEY,
      source_platform TEXT DEFAULT 'Indeed',
      company_name TEXT NOT NULL,
      job_title TEXT NOT NULL,
      location TEXT DEFAULT 'not given',
      job_url TEXT NOT NULL,
      salary TEXT DEFAULT 'not given',
      hr_email TEXT DEFAULT 'not given',
      job_description TEXT,
      cv_template_used TEXT,
      status TEXT DEFAULT 'PENDING',
      scraped_at TEXT DEFAULT CURRENT_TIMESTAMP,
      applied_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_applications_status
      ON applications(status);

    CREATE INDEX IF NOT EXISTS idx_applications_scraped_at
      ON applications(scraped_at);
  `);
}

export async function listApplications({ status = 'ALL', search = '' } = {}) {
  await initDB();
  const db = await getDB();
  const params = [];
  const filters = [];

  if (status && status !== 'ALL') {
    filters.push('status = ?');
    params.push(status);
  }

  if (search) {
    filters.push(`(
      company_name LIKE ?
      OR job_title LIKE ?
      OR location LIKE ?
      OR hr_email LIKE ?
    )`);
    const query = `%${search}%`;
    params.push(query, query, query, query);
  }

  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

  return db.all(
    `
      SELECT
        internal_job_id,
        source_platform,
        company_name,
        job_title,
        location,
        job_url,
        salary,
        hr_email,
        cv_template_used,
        status,
        scraped_at,
        applied_at
      FROM applications
      ${where}
      ORDER BY datetime(scraped_at) DESC, company_name ASC
      LIMIT 200
    `,
    params,
  );
}

export async function getApplicationMetrics() {
  await initDB();
  const db = await getDB();
  const rows = await db.all(`
    SELECT status, COUNT(*) AS count
    FROM applications
    GROUP BY status
  `);

  return rows.reduce(
    (metrics, row) => ({
      ...metrics,
      total: metrics.total + row.count,
      [row.status.toLowerCase()]: row.count,
    }),
    { total: 0 },
  );
}

export async function upsertApplication(payload) {
  await initDB();
  const db = await getDB();

  return db.run(
    `
      INSERT INTO applications (
        internal_job_id,
        source_platform,
        company_name,
        job_title,
        location,
        job_url,
        salary,
        hr_email,
        job_description,
        cv_template_used,
        status,
        scraped_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))
      ON CONFLICT(internal_job_id) DO UPDATE SET
        source_platform = excluded.source_platform,
        company_name = excluded.company_name,
        job_title = excluded.job_title,
        location = excluded.location,
        job_url = excluded.job_url,
        salary = excluded.salary,
        hr_email = excluded.hr_email,
        job_description = excluded.job_description,
        scraped_at = excluded.scraped_at
    `,
    [
      payload.internal_job_id,
      payload.source_platform || 'Indeed',
      payload.company_name,
      payload.job_title,
      payload.location || 'not given',
      payload.job_url,
      payload.salary || 'not given',
      payload.hr_email || 'not given',
      payload.job_description || '',
      payload.cv_template_used || null,
      payload.status || 'PENDING',
      payload.scraped_at || null,
    ],
  );
}

initDB().catch((err) => console.error('Database init error:', err));
