import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const PROFILES = [
  {
    category: 'tech',
    label: 'Software Development',
    filename: 'tech_cv.md',
  },
  {
    category: 'robotics',
    label: 'Robotics & AI',
    filename: 'robotics_cv.md',
  },
  {
    category: 'education',
    label: 'Academic / Education',
    filename: 'education_cv.md',
  },
];

export async function GET() {
  try {
    const folder = path.join(process.cwd(), 'storage', 'master_cvs');
    await fs.mkdir(folder, { recursive: true });

    const profiles = await Promise.all(
      PROFILES.map(async (profile) => {
        const filePath = path.join(folder, profile.filename);

        try {
          const stat = await fs.stat(filePath);

          return {
            ...profile,
            exists: true,
            bytes: stat.size,
            updatedAt: stat.mtime.toISOString(),
            path: filePath,
          };
        } catch (error) {
          if (error.code !== 'ENOENT') {
            throw error;
          }

          return {
            ...profile,
            exists: false,
            bytes: 0,
            updatedAt: null,
            path: filePath,
          };
        }
      }),
    );

    return NextResponse.json({ profiles });
  } catch (error) {
    console.error('Profiles endpoint crashed:', error);
    return NextResponse.json({ error: 'Failed to load profiles' }, { status: 500 });
  }
}
