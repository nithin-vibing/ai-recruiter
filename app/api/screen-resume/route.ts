import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { resumeContent, rubric } = body;

    if (!resumeContent || !rubric) {
      return NextResponse.json(
        { error: 'Missing required fields: resumeContent and rubric' },
        { status: 400 }
      );
    }

    // Check if n8n webhook URL is configured
    const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;
    
    if (n8nWebhookUrl) {
      // Forward to n8n webhook
      const response = await fetch(`${n8nWebhookUrl}/screen-resume`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ resumeContent, rubric }),
      });

      if (!response.ok) {
        throw new Error(`n8n webhook failed: ${response.statusText}`);
      }

      const data = await response.json();
      return NextResponse.json(data);
    }

    // Fallback: Generate mock candidate data
    const names = [
      'Alex Johnson', 'Sarah Chen', 'Michael Park', 'Emily Davis', 
      'James Wilson', 'Maria Garcia', 'David Kim', 'Lisa Thompson'
    ];
    
    const randomName = names[Math.floor(Math.random() * names.length)];
    const totalScore = Math.floor(Math.random() * 40) + 60; // 60-100

    const scores = rubric.map((criterion: { id: string; name: string; maxScore: number }) => ({
      criterionId: criterion.id,
      criterionName: criterion.name,
      score: Math.floor(Math.random() * 4) + (criterion.maxScore - 4),
      maxScore: criterion.maxScore,
    }));

    const mockCandidate = {
      name: randomName,
      email: `${randomName.toLowerCase().replace(' ', '.')}@email.com`,
      phone: `+1 (555) ${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 9000) + 1000}`,
      linkedIn: `https://linkedin.com/in/${randomName.toLowerCase().replace(' ', '-')}`,
      totalScore,
      scores,
      reasoning: `Strong candidate with ${totalScore > 80 ? 'excellent' : totalScore > 70 ? 'good' : 'adequate'} qualifications. Shows proficiency in required skills and relevant experience in the field. Communication skills are ${totalScore > 75 ? 'above average' : 'satisfactory'}.`,
    };

    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 500));

    return NextResponse.json({ candidate: mockCandidate });
  } catch (error) {
    console.error('Error screening resume:', error);
    return NextResponse.json(
      { error: 'Failed to screen resume' },
      { status: 500 }
    );
  }
}
