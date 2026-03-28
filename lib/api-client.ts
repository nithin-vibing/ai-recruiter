// API Client for n8n Webhook Integration
// Replace these URLs with your actual n8n webhook endpoints

const N8N_WEBHOOK_BASE = process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL || '';

export interface GenerateRubricRequest {
  jobDescription: string;
  roleName: string;
}

export interface GenerateRubricResponse {
  rubric: {
    id: string;
    name: string;
    description: string;
    maxScore: number;
    weight: number;
  }[];
}

export interface ScreenResumeRequest {
  resumeContent: string;
  rubric: {
    id: string;
    name: string;
    description: string;
    maxScore: number;
    weight: number;
  }[];
}

export interface ScreenResumeResponse {
  candidate: {
    name: string;
    email: string;
    phone: string;
    linkedIn: string;
    totalScore: number;
    scores: {
      criterionId: string;
      criterionName: string;
      score: number;
      maxScore: number;
    }[];
    reasoning: string;
  };
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async generateRubric(data: GenerateRubricRequest): Promise<GenerateRubricResponse> {
    if (!this.baseUrl) {
      throw new Error('N8N_WEBHOOK_URL is not configured. Set NEXT_PUBLIC_N8N_WEBHOOK_URL environment variable.');
    }

    const response = await fetch(`${this.baseUrl}/generate-rubric`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`Failed to generate rubric: ${response.statusText}`);
    }

    return response.json();
  }

  async screenResume(data: ScreenResumeRequest): Promise<ScreenResumeResponse> {
    if (!this.baseUrl) {
      throw new Error('N8N_WEBHOOK_URL is not configured. Set NEXT_PUBLIC_N8N_WEBHOOK_URL environment variable.');
    }

    const response = await fetch(`${this.baseUrl}/screen-resume`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`Failed to screen resume: ${response.statusText}`);
    }

    return response.json();
  }
}

export const apiClient = new ApiClient(N8N_WEBHOOK_BASE);

// Helper to extract text from PDF (would need pdf-parse or similar)
export async function extractTextFromFile(file: File): Promise<string> {
  // For now, return filename as placeholder
  // In production, use pdf-parse or similar library
  return `Resume content from: ${file.name}`;
}
