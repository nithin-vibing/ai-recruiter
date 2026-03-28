import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { jobDescription, roleName } = body;

    if (!jobDescription || !roleName) {
      return NextResponse.json(
        { error: 'Missing required fields: jobDescription and roleName' },
        { status: 400 }
      );
    }

    // Check if n8n webhook URL is configured
    const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;
    
    if (n8nWebhookUrl) {
      // Forward to n8n webhook
      const response = await fetch(`${n8nWebhookUrl}/generate-rubric`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ jobDescription, roleName }),
      });

      if (!response.ok) {
        throw new Error(`n8n webhook failed: ${response.statusText}`);
      }

      const data = await response.json();
      return NextResponse.json(data);
    }

    // Fallback: Generate mock rubric
    const mockRubric = [
      {
        id: crypto.randomUUID(),
        name: 'Technical Skills',
        description: 'Proficiency in required technologies and programming languages',
        maxScore: 10,
        weight: 0.25,
      },
      {
        id: crypto.randomUUID(),
        name: 'Experience',
        description: 'Relevant work experience and industry knowledge',
        maxScore: 10,
        weight: 0.20,
      },
      {
        id: crypto.randomUUID(),
        name: 'Education',
        description: 'Educational background and certifications',
        maxScore: 10,
        weight: 0.15,
      },
      {
        id: crypto.randomUUID(),
        name: 'Problem Solving',
        description: 'Demonstrated ability to solve complex problems',
        maxScore: 10,
        weight: 0.15,
      },
      {
        id: crypto.randomUUID(),
        name: 'Communication',
        description: 'Written and verbal communication skills',
        maxScore: 10,
        weight: 0.10,
      },
      {
        id: crypto.randomUUID(),
        name: 'Leadership',
        description: 'Leadership experience and team collaboration',
        maxScore: 10,
        weight: 0.10,
      },
      {
        id: crypto.randomUUID(),
        name: 'Culture Fit',
        description: 'Alignment with company values and work style',
        maxScore: 10,
        weight: 0.05,
      },
    ];

    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    return NextResponse.json({ rubric: mockRubric });
  } catch (error) {
    console.error('Error generating rubric:', error);
    return NextResponse.json(
      { error: 'Failed to generate rubric' },
      { status: 500 }
    );
  }
}
