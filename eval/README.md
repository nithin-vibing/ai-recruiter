# Evals

AI quality tests for ShortlistAI. Run these before shipping any prompt change.

## What's tested

| Eval | Question | Type |
|---|---|---|
| Rubric structure | Valid JSON, 5 criteria, weights sum to 1.0, names ≤20 chars | Deterministic |
| Scoring consistency | Same resume scored 3× stays within ±5 points | Statistical |
| Ranking accuracy | Gold set (strong/medium/weak) ranks in the right order | Order assertion |

## Setup

```bash
pnpm add -D vitest
```

Add your API key to `.env.local` (already there from the main app).

## Run

```bash
ANTHROPIC_API_KEY=your_key npx vitest eval/
```

Costs ~$0.10 per full run.

## Fixtures

- `fixtures/jd-frontend-engineer.txt` — sample JD for a Senior Frontend Engineer
- `fixtures/resume-strong.txt` — resume you'd shortlist (fill in with a real example)
- `fixtures/resume-medium.txt` — resume you'd hold
- `fixtures/resume-weak.txt` — resume you'd reject

The gold set is the most important thing to calibrate. Use real resumes you've manually ranked.
