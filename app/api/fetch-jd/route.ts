import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import * as cheerio from 'cheerio';

const MAX_JD_LENGTH = 20000;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let url: string;
  try {
    const body = await request.json();
    url = body.url;
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'Missing url' }, { status: 400 });
    }
    new URL(url); // validate format
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'fetch_failed' }, { status: 422 });
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('text/html')) {
      return NextResponse.json({ error: 'fetch_failed' }, { status: 422 });
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Remove noise
    $('script, style, nav, header, footer, [role="navigation"], [aria-label="navigation"]').remove();

    // Try to grab the main content area first; fall back to body
    const contentEl =
      $('main').first().text() ||
      $('article').first().text() ||
      $('[role="main"]').first().text() ||
      $('body').text();

    const jobDescription = contentEl
      .replace(/\s{3,}/g, '\n\n')  // collapse excessive whitespace
      .replace(/[ \t]+/g, ' ')
      .trim()
      .slice(0, MAX_JD_LENGTH);

    if (jobDescription.length < 100) {
      return NextResponse.json({ error: 'too_short' }, { status: 422 });
    }

    return NextResponse.json({ jobDescription });
  } catch {
    return NextResponse.json({ error: 'fetch_failed' }, { status: 422 });
  }
}
