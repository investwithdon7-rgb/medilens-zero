/** Call the Bluehost PHP AI proxy for user-triggered AI tasks. */

const AI_PROXY_URL = import.meta.env.VITE_AI_PROXY_URL || 'api/ai.php';

export type AiTask =
  | 'policy_brief'
  | 'appeal_letter'
  | 'country_narrative'
  | 'equivalence'
  | 'drug_country_analysis'
  | 'shortage_risk'
  | 'advocacy_plan';

export const AI_TASK_LABELS: Record<AiTask, string> = {
  policy_brief:          'Policy Brief',
  appeal_letter:         'Appeal Letter',
  country_narrative:     'Country Briefing',
  equivalence:           'Equivalence Analysis',
  drug_country_analysis: 'Drug–Country Analysis',
  shortage_risk:         'Supply Chain Risk',
  advocacy_plan:         'Advocacy Action Plan',
};

interface AiRequest {
  task: AiTask;
  payload: Record<string, unknown>;
}

const AI_PROXY_TOKEN = import.meta.env.VITE_AI_PROXY_TOKEN || '';

export async function callAiProxy(req: AiRequest): Promise<string> {
  const res = await fetch(AI_PROXY_URL, {
    method:  'POST',
    headers: {
      'Content-Type':    'application/json',
      'X-Medilens-Token': AI_PROXY_TOKEN,
    },
    body: JSON.stringify(req),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'AI service error');
  }

  const data = await res.json();
  return data.result as string;
}
