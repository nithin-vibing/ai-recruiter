# Domain Glossary — AI Recruiter

## Project
A hiring initiative for a specific role. Contains one Job Description, one Rubric, and many Candidates. The unit of work for a hiring manager.

## Job Description (JD)
Unstructured text describing a role — responsibilities, requirements, nice-to-haves. Source material for Rubric generation. Can be pasted manually or fetched from a URL.

## Rubric
A set of weighted Criteria generated from a JD by Claude (Sonnet). Defines *how* Candidates will be scored. Belongs to one Project. Generated once, editable before screening.

## Criterion
A single evaluation dimension within a Rubric (e.g. "Python experience", "Leadership"). Has a name, description, weight (0–1, all weights sum to 1.0), and max_score.

## Candidate
A person who applied for the role. Holds raw resume text (extracted from PDF in the browser), and scoring outputs: score, criteria_scores, reasoning, confidence, status.

## Candidate Status
One of: `pending` (not yet scored), `scored` (Claude returned a valid result), `failed` (Claude call failed — review manually).

## Screening
The process of scoring all Candidates in a Project against its Rubric. Runs in parallel (5 concurrent Claude Haiku calls). Progress is tracked by polling Supabase.

## Score
A number 0–100 representing a Candidate's overall fit. Computed deterministically as: `sum(score / max_score × weight × 100)` across all Criteria. Never trusted from Claude's output — always recomputed.

## Rescore
Re-running Screening after the Rubric has been edited. Overwrites existing scores in place. No history preserved.
