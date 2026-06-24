interface RubricCriterion {
  criterion: string;
  description: string;
  max_score: number;
  weight: number;
  scoring_guide?: { high?: string; mid?: string; low?: string } | string;
}

export const SCREENING_SYSTEM_PROMPT = `<Role>
You are an expert talent evaluator with 15+ years of experience screening resumes for competitive roles. You give consistent, evidence-based scores grounded in what the resume actually says — not assumptions.
</Role>

<Instruction>
Score the resume against each rubric criterion using the scoring anchors as your guide. For every criterion, find a direct quote or paraphrase from the resume that justifies your score. If evidence is absent, score low.
</Instruction>

<Guardrails>
- Never invent or infer experience not stated in the resume
- Apply scoring anchors consistently — do not round up out of generosity
- Extract contact info exactly as written; use null if not present
- Output ONLY the JSON object — no preamble, no explanation outside the JSON
</Guardrails>`;

export function buildScreeningUserPrompt(
  resumeText: string,
  rubric: RubricCriterion[]
): string {
  const rubricText = rubric
    .map((r) => {
      let text = `### ${r.criterion} (weight: ${r.weight}, max score: ${r.max_score})\n`;
      text += `Description: ${r.description}\n`;
      if (r.scoring_guide) {
        const sg =
          typeof r.scoring_guide === 'string'
            ? JSON.parse(r.scoring_guide)
            : r.scoring_guide;
        if (sg.high) text += `- High (${Math.round(r.max_score * 0.8)}–${r.max_score}): ${sg.high}\n`;
        if (sg.mid) text += `- Mid (${Math.round(r.max_score * 0.4)}–${Math.round(r.max_score * 0.7)}): ${sg.mid}\n`;
        if (sg.low) text += `- Low (0–${Math.round(r.max_score * 0.3)}): ${sg.low}\n`;
      }
      return text;
    })
    .join('\n');

  return `<Task>
Score this resume against the rubric below. Follow these steps:

1. Read the full resume once before scoring anything
2. For each criterion, find the strongest supporting evidence in the resume
3. Match that evidence to the scoring anchor (high/mid/low) to pick your score
4. Write a short evidence quote (max 20 words) directly from the resume
5. Compute total_score as a 0–100 weighted percentage:
   total_score = sum of (score / max_score × weight × 100) for all criteria
   Example: score 8/10 with weight 0.3 → contributes 8/10 × 0.3 × 100 = 24 points
6. Write a structured AI summary:
   - strength: 1 crisp sentence on the single strongest reason to interview this person for this specific role
   - weakness: 1 crisp sentence on the single biggest gap vs. the JD
</Task>

<Rubric>
${rubricText}
</Rubric>

<Resume>
${resumeText}
</Resume>

Respond ONLY with this exact JSON — no other text:
{
  "candidate_name": "Full Name or null",
  "email": "email@example.com or null",
  "phone": "phone number or null",
  "linkedin": "LinkedIn URL or null",
  "criteria_scores": [
    {
      "criterion": "criterion name",
      "score": 8,
      "max_score": 10,
      "weight": 0.2,
      "evidence": "direct quote or paraphrase from resume"
    }
  ],
  "total_score": 74.5,
  "summary": {
    "strength": "One crisp sentence on the strongest reason to hire for this role.",
    "weakness": "One crisp sentence on the biggest gap vs. the JD."
  },
  "confidence": "high | medium | low"
}`;
}
