import OpenAI from 'openai';

type ModelInput = {
  provider?: string;
  baseUrl: string;
  apiKey: string;
  name: string;
  family?: string;
};

type ModelUsage = {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
};

type ModelTestResult = {
  ok: boolean;
  content: string;
  durationMs: number;
  usage?: ModelUsage;
};

function normalizeBaseUrl(value: string) {
  return value.trim().replace(/\/+$/, '');
}

function normalizeModelName(value: string) {
  return value.trim().replace(/[‐‑‒–—―]/g, '-');
}

function visibleContent(value: string) {
  return value.replace(/<think>[\s\S]*?<\/think>/g, '').trim() || value.trim();
}

export async function testModelConnection(input: ModelInput, options?: { signal: AbortSignal; imageDataUrl?: string }): Promise<ModelTestResult> {
  const baseUrl = normalizeBaseUrl(input.baseUrl);
  const modelName = normalizeModelName(input.name);

  if (!baseUrl || !input.apiKey.trim() || !modelName) {
    throw new Error('模型配置不完整');
  }

  const startedAt = Date.now();
  const client = new OpenAI({
    apiKey: input.apiKey.trim(),
    baseURL: baseUrl,
    ...(options ? { timeout: 30000, maxRetries: 0 } : {}),
  });

  const result = await client.chat.completions.create({
    model: modelName,
    ...(!options ? { temperature: 0, max_completion_tokens: 128 } : {}),
    messages: [
      {
        role: 'user',
        content: options?.imageDataUrl ? [{ type: 'text', text: 'Reply with OK only.' }, { type: 'image_url', image_url: { url: options.imageDataUrl } }] : 'Reply with OK only.',
      },
    ],
  }, { signal: options?.signal });

  const content = visibleContent(result.choices[0]?.message?.content || '');
  if (!content) throw new Error('模型未返回有效内容，请检查模型配置');
  const usage: ModelUsage = {
    promptTokens: result.usage?.prompt_tokens,
    completionTokens: result.usage?.completion_tokens,
    totalTokens: result.usage?.total_tokens,
  };

  return {
    ok: true,
    content,
    durationMs: Date.now() - startedAt,
    usage,
  };
}
