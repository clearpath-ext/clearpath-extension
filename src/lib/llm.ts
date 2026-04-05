import type { Settings, ReadingLevel } from '../shared/types'

// ── Interface ─────────────────────────────────────────────────────────────────

export interface LLMProvider {
  simplify(text: string, level: ReadingLevel): Promise<string>
  summarize(text: string): Promise<string>
}

// ── Prompts ───────────────────────────────────────────────────────────────────

function simplifyPrompt(text: string, level: ReadingLevel): string {
  return `You are a plain language expert. Rewrite the following text so it is easy to understand for someone reading at a grade ${level} level.\nRules: short sentences (max 15 words), common words, same meaning, active voice, no jargon.\nRespond with ONLY the simplified text. No preamble.\n\n${text}`
}

function summarizePrompt(text: string): string {
  return `Summarize the following webpage content in plain English.\nRules: 3–5 sentences max, Grade 5 reading level, facts only, no opinions.\nRespond with ONLY the summary. No preamble.\n\n${text}`
}

// ── HTTP helper ───────────────────────────────────────────────────────────────

async function checkResponse(res: Response): Promise<void> {
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`HTTP ${res.status}: ${body}`)
  }
}

// ── Providers ─────────────────────────────────────────────────────────────────

class NoProvider implements LLMProvider {
  simplify(): Promise<string> {
    return Promise.reject(
      new Error('No LLM provider configured. Add an API key in the ClearPath popup.'),
    )
  }
  summarize(): Promise<string> {
    return Promise.reject(
      new Error('No LLM provider configured. Add an API key in the ClearPath popup.'),
    )
  }
}

class OpenAIProvider implements LLMProvider {
  constructor(private apiKey: string) {}

  simplify(text: string, level: ReadingLevel): Promise<string> {
    console.debug('[ClearPath] LLM (OpenAI): simplify — level:', level, 'chars:', text.length)
    return this.call(simplifyPrompt(text, level))
  }

  summarize(text: string): Promise<string> {
    console.debug('[ClearPath] LLM (OpenAI): summarize — chars:', text.length)
    return this.call(summarizePrompt(text))
  }

  private async call(prompt: string): Promise<string> {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 1000,
      }),
    })
    await checkResponse(res)
    const data = (await res.json()) as { choices: Array<{ message: { content: string } }> }
    return data.choices[0].message.content
  }
}

class AnthropicProvider implements LLMProvider {
  constructor(private apiKey: string) {}

  simplify(text: string, level: ReadingLevel): Promise<string> {
    console.debug('[ClearPath] LLM (Anthropic): simplify — level:', level, 'chars:', text.length)
    return this.call(simplifyPrompt(text, level))
  }

  summarize(text: string): Promise<string> {
    console.debug('[ClearPath] LLM (Anthropic): summarize — chars:', text.length)
    return this.call(summarizePrompt(text))
  }

  private async call(prompt: string): Promise<string> {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    await checkResponse(res)
    const data = (await res.json()) as { content: Array<{ text: string }> }
    return data.content[0].text
  }
}

class OllamaProvider implements LLMProvider {
  constructor(
    private ollamaUrl: string,
    private model: string,
  ) {}

  simplify(text: string, level: ReadingLevel): Promise<string> {
    console.debug('[ClearPath] LLM (Ollama): simplify — model:', this.model, 'level:', level, 'chars:', text.length)
    return this.call(simplifyPrompt(text, level))
  }

  summarize(text: string): Promise<string> {
    console.debug('[ClearPath] LLM (Ollama): summarize — model:', this.model, 'chars:', text.length)
    return this.call(summarizePrompt(text))
  }

  private async call(prompt: string): Promise<string> {
    const res = await fetch(`${this.ollamaUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        stream: false,
      }),
    })
    await checkResponse(res)
    const data = (await res.json()) as { message: { content: string } }
    return data.message.content
  }
}

// ── Factory ───────────────────────────────────────────────────────────────────

export function createProvider(settings: Settings): LLMProvider {
  switch (settings.llmProvider) {
    case 'openai':
      return new OpenAIProvider(settings.apiKey)
    case 'anthropic':
      return new AnthropicProvider(settings.apiKey)
    case 'ollama':
      return new OllamaProvider(settings.ollamaUrl, settings.ollamaModel ?? 'llama3.2')
    default:
      return new NoProvider()
  }
}
