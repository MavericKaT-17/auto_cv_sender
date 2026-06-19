import { NextResponse } from 'next/server';
import {
  getApplicationMetrics,
  listApplications,
  upsertApplication,
} from '../../../lib/db.js';

const REQUIRED_FIELDS = [
  'internal_job_id',
  'company_name',
  'job_title',
  'job_url',
];

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') || 'ALL';
  const search = searchParams.get('search') || '';

  try {
    const [jobs, metrics] = await Promise.all([
      listApplications({ status, search }),
      getApplicationMetrics(),
    ]);

    return NextResponse.json({ jobs, metrics });
  } catch (error) {
    console.error('Jobs endpoint crashed:', error);
    return NextResponse.json({ error: 'Failed to load jobs' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const payload = await request.json();
    const missing = REQUIRED_FIELDS.filter((field) => !payload[field]);

    if (missing.length) {
      return NextResponse.json(
        { error: `Missing required fields: ${missing.join(', ')}` },
        { status: 400 },
      );
    }

    await upsertApplication(payload);

    return NextResponse.json({
      success: true,
      message: `Tracked ${payload.internal_job_id}`,
    });
  } catch (error) {
    console.error('Job ingestion endpoint crashed:', error);
    return NextResponse.json({ error: 'Failed to save job' }, { status: 500 });
  }
}
