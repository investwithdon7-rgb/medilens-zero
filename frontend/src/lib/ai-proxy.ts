/** Call the Bluehost PHP AI proxy for user-triggered AI tasks. */

const AI_PROXY_URL = import.meta.env.VITE_AI_PROXY_URL || 'api/ai.php';

export type AiTask =
  | 'policy_brief'
  | 'appeal_letter'
  | 'country_narrative'
  | 'equivalence';

interface AiRequest {
  task: AiTask;
  payload: Record<string, unknown>;
}

export async function callAiProxy(req: AiRequest): Promise<string> {
  const res = await fetch(AI_PROXY_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(req),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'AI service error');
  }

  const data = await res.json();
  return data.result as string;
}
