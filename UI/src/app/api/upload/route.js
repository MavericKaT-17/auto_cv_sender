import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const ALLOWED_CATEGORIES = new Set(['tech', 'robotics', 'education']);
const MAX_UPLOAD_BYTES = 1024 * 1024;

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const category = formData.get('category') || 'tech';

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    if (!ALLOWED_CATEGORIES.has(category)) {
      return NextResponse.json({ error: 'Invalid CV category' }, { status: 400 });
    }

    if (!file.name.endsWith('.md')) {
      return NextResponse.json({ error: 'Only Markdown files are accepted' }, { status: 400 });
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: 'Markdown file must be 1 MB or smaller' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const targetFolder = path.join(process.cwd(), 'storage', 'master_cvs');
    const finalFilename = `${category}_cv.md`;
    const targetPath = path.join(targetFolder, finalFilename);

    await fs.mkdir(targetFolder, { recursive: true });
    await fs.writeFile(targetPath, buffer);
    console.log(`[OK] Master CV saved locally at: ${targetPath}`);

    return NextResponse.json({
      success: true,
      message: `Saved as ${finalFilename}`,
      profile: {
        category,
        filename: finalFilename,
        bytes: buffer.byteLength,
        path: targetPath,
      },
    });
  } catch (error) {
    console.error('Upload endpoint crashed:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
