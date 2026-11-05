export type ModelInputPart = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string; detail?: string } };
export type ModelInput = { messages: Array<{ role: string; content: string | ModelInputPart[] }>; maxCompletionTokens?: number };
export type ModelResponse = {
  model: string; createdAt: string; durationMs: number; finishReason: string; reasoning: string; content: string;
  request?: ModelInput;
  error?: string;
};

export function readModelInput(messages: Array<{ role: string; content?: unknown }>, apiKey: string, maxCompletionTokens?: number): ModelInput {
  const redact = (value: string) => apiKey ? value.split(apiKey).join('[REDACTED]') : value;
  return { messages: messages.map(message => ({ role: message.role, content: typeof message.content === 'string' ? redact(message.content)
    : Array.isArray(message.content) ? message.content.flatMap((part): ModelInputPart[] => part.type === 'text' ? [{ type: 'text', text: redact(part.text) }]
      : part.type === 'image_url' ? [{ type: 'image_url', image_url: { ...part.image_url } }] : []) : '' })),
    ...(maxCompletionTokens === undefined ? {} : { maxCompletionTokens }) };
}

/** Keep only text actually returned by the provider, never request data or encrypted reasoning. */
export function readModelResponse(message: unknown, model: string, apiKey: string, durationMs: number, finishReason: string): ModelResponse {
  const data = (message && typeof message === 'object' ? message : {}) as Record<string, unknown>;
  const text = (value: unknown): string => typeof value === 'string' ? value
    : Array.isArray(value) ? value.map(part => typeof part === 'string' ? part
      : part && typeof part === 'object' ? text(part.text ?? part.summary) : '').filter(Boolean).join('\n\n') : '';
  const redact = (value: string) => apiKey ? value.split(apiKey).join('[REDACTED]') : value;
  const content = text(data.content);
  const reasoning = [...new Set([text(data.reasoning_content), text(data.reasoning), text(data.reasoning_details),
    ...Array.from(content.matchAll(/<think>([\s\S]*?)<\/think>/gi), match => match[1]!.trim())].filter(value => value.trim()))].join('\n\n');
  return { model, createdAt: new Date().toISOString(), durationMs, finishReason, reasoning: redact(reasoning), content: redact(content) };
}
