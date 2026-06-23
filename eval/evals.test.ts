import { describe, test, expect } from 'vitest';
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import { RUBRIC_SYSTEM_PROMPT, buildRubricUserPrompt } from '../lib/prompts/rubric';
import { SCREENING_SYSTEM_PROMPT, buildScreeningUserPrompt } from '../lib/prompts/screening';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const fixtures = (name: string) =>
  fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf-8');

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function generateRubric(jd: string, role = 'Senior Frontend Engineer') {
  const msg = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    system: RUBRIC_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildRubricUserPrompt(role, jd) }],
  });
  const text = msg.content[0].type === 'text' ? msg.content[0].text : '';
  return JSON.parse(text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());
}

async function scoreResume(resumeText: string, rubric: unknown[]) {
  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1500,
    system: SCREENING_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildScreeningUserPrompt(resumeText, rubric as never) }],
  });
  const text = msg.content[0].type === 'text' ? msg.content[0].text : '';
  const parsed = JSON.parse(text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());

  // Always recompute total_score — never trust Claude's value
  return Math.round(
    parsed.criteria_scores.reduce(
      (sum: number, c: { score: number; max_score: number; weight: number }) =>
        sum + (c.max_score > 0 ? (c.score / c.max_score) * c.weight * 100 : 0),
      0
    ) * 10
  ) / 10;
}

// ─── Rubric evals ─────────────────────────────────────────────────────────────

describe('rubric generation', () => {
  test('returns exactly 5 criteria', async () => {
    const jd = fixtures('jd-frontend-engineer.txt');
    const rubric = await generateRubric(jd);
    expect(rubric).toHaveLength(5);
  });

  test('weights sum to 1.0 (±0.02)', async () => {
    const jd = fixtures('jd-frontend-engineer.txt');
    const rubric = await generateRubric(jd);
    const total = rubric.reduce((s: number, r: { weight: number }) => s + r.weight, 0);
    expect(Math.abs(total - 1.0)).toBeLessThan(0.02);
  });

  test('criterion names are ≤20 characters', async () => {
    const jd = fixtures('jd-frontend-engineer.txt');
    const rubric = await generateRubric(jd);
    rubric.forEach((r: { criterion: string }) => {
      expect(r.criterion.length).toBeLessThanOrEqual(20);
    });
  });

  test('descriptions are ≤90 characters', async () => {
    const jd = fixtures('jd-frontend-engineer.txt');
    const rubric = await generateRubric(jd);
    rubric.forEach((r: { description: string }) => {
      expect(r.description.length).toBeLessThanOrEqual(90);
    });
  });
});

// ─── Scoring evals ────────────────────────────────────────────────────────────

describe('resume scoring', () => {
  test('gold set: strong > medium > weak', async () => {
    const jd = fixtures('jd-frontend-engineer.txt');
    const rubric = await generateRubric(jd);

    const [strong, medium, weak] = await Promise.all([
      scoreResume(fixtures('resume-strong.txt'), rubric),
      scoreResume(fixtures('resume-medium.txt'), rubric),
      scoreResume(fixtures('resume-weak.txt'), rubric),
    ]);

    expect(strong).toBeGreaterThan(medium);
    expect(medium).toBeGreaterThan(weak);
  });

  test('consistency: same resume within ±5 points across 3 runs', async () => {
    const jd = fixtures('jd-frontend-engineer.txt');
    const rubric = await generateRubric(jd);
    const resume = fixtures('resume-strong.txt');

    const scores = await Promise.all([1, 2, 3].map(() => scoreResume(resume, rubric)));
    const max = Math.max(...scores);
    const min = Math.min(...scores);

    expect(max - min).toBeLessThanOrEqual(5);
  });

  test('score is between 0 and 100', async () => {
    const jd = fixtures('jd-frontend-engineer.txt');
    const rubric = await generateRubric(jd);
    const score = await scoreResume(fixtures('resume-strong.txt'), rubric);

    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});
