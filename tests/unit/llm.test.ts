import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createProvider } from '../../src/lib/llm'
import { DEFAULT_SETTINGS } from '../../src/shared/types'
import type { Settings } from '../../src/shared/types'

const baseSettings: Settings = { ...DEFAULT_SETTINGS }

describe('llm', () => {
  describe('NoProvider (llmProvider: none)', () => {
    const provider = createProvider({ ...baseSettings, llmProvider: 'none' })

    it('simplify() rejects with "No LLM provider configured" message', async () => {
      await expect(provider.simplify('some text', 5)).rejects.toThrow(
        'No LLM provider configured. Add an API key in the ClearPath popup.',
      )
    })

    it('summarize() rejects with "No LLM provider configured" message', async () => {
      await expect(provider.summarize('some text')).rejects.toThrow(
        'No LLM provider configured. Add an API key in the ClearPath popup.',
      )
    })
  })

  describe('OpenAIProvider', () => {
    beforeEach(() => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ choices: [{ message: { content: 'simplified' } }] }),
        }),
      )
    })

    afterEach(() => {
      vi.unstubAllGlobals()
    })

    it('calls the correct URL with Authorization header', async () => {
      const provider = createProvider({ ...baseSettings, llmProvider: 'openai', apiKey: 'sk-test' })
      await provider.simplify('complex text', 5)

      expect(fetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ Authorization: 'Bearer sk-test' }),
        }),
      )
    })

    it('sends correct model, temperature, and max_tokens in body', async () => {
      const provider = createProvider({ ...baseSettings, llmProvider: 'openai', apiKey: 'sk-x' })
      await provider.simplify('text', 3)

      const body = JSON.parse(
        (vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string,
      ) as Record<string, unknown>
      expect(body.model).toBe('gpt-4o-mini')
      expect(body.temperature).toBe(0.3)
      expect(body.max_tokens).toBe(1000)
    })

    it('returns choices[0].message.content', async () => {
      const provider = createProvider({ ...baseSettings, llmProvider: 'openai', apiKey: 'sk-x' })
      const result = await provider.simplify('text', 5)
      expect(result).toBe('simplified')
    })

    it('summarize() calls the API and returns extracted content', async () => {
      const provider = createProvider({ ...baseSettings, llmProvider: 'openai', apiKey: 'sk-x' })
      const result = await provider.summarize('long article text')
      expect(fetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.objectContaining({ method: 'POST' }),
      )
      expect(result).toBe('simplified')
    })

    it('throws with HTTP status on non-200 response', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 401,
          text: () => Promise.resolve('Unauthorized'),
        }),
      )
      const provider = createProvider({ ...baseSettings, llmProvider: 'openai', apiKey: 'bad' })
      await expect(provider.simplify('text', 5)).rejects.toThrow('401')
    })

    it('uses empty string for error body when text() itself rejects', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 500,
          text: () => Promise.reject(new Error('body read failed')),
        }),
      )
      const provider = createProvider({ ...baseSettings, llmProvider: 'openai', apiKey: 'sk-x' })
      await expect(provider.simplify('text', 5)).rejects.toThrow('500')
    })
  })

  describe('AnthropicProvider', () => {
    beforeEach(() => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ content: [{ text: 'simpler' }] }),
        }),
      )
    })

    afterEach(() => {
      vi.unstubAllGlobals()
    })

    it('calls the correct URL with x-api-key and anthropic-version headers', async () => {
      const provider = createProvider({
        ...baseSettings,
        llmProvider: 'anthropic',
        apiKey: 'ant-test',
      })
      await provider.simplify('text', 3)

      expect(fetch).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/messages',
        expect.objectContaining({
          headers: expect.objectContaining({
            'x-api-key': 'ant-test',
            'anthropic-version': '2023-06-01',
          }),
        }),
      )
    })

    it('returns content[0].text', async () => {
      const provider = createProvider({
        ...baseSettings,
        llmProvider: 'anthropic',
        apiKey: 'ant',
      })
      const result = await provider.simplify('text', 5)
      expect(result).toBe('simpler')
    })

    it('summarize() calls the API and returns content[0].text', async () => {
      const provider = createProvider({ ...baseSettings, llmProvider: 'anthropic', apiKey: 'ant' })
      const result = await provider.summarize('article text')
      expect(fetch).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/messages',
        expect.objectContaining({ method: 'POST' }),
      )
      expect(result).toBe('simpler')
    })

    it('throws with HTTP status on non-200 response', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 429,
          text: () => Promise.resolve('Rate limited'),
        }),
      )
      const provider = createProvider({ ...baseSettings, llmProvider: 'anthropic', apiKey: 'ant' })
      await expect(provider.simplify('text', 5)).rejects.toThrow('429')
    })
  })

  describe('OllamaProvider', () => {
    beforeEach(() => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ message: { content: 'ollama output' } }),
        }),
      )
    })

    afterEach(() => {
      vi.unstubAllGlobals()
    })

    it('calls ${ollamaUrl}/api/chat with the configured model', async () => {
      const provider = createProvider({
        ...baseSettings,
        llmProvider: 'ollama',
        ollamaUrl: 'http://localhost:11434',
        ollamaModel: 'llama3.2',
      })
      await provider.simplify('text', 8)

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:11434/api/chat',
        expect.objectContaining({
          body: expect.stringContaining('"llama3.2"'),
        }),
      )
    })

    it('returns message.content from the response', async () => {
      const provider = createProvider({
        ...baseSettings,
        llmProvider: 'ollama',
        ollamaUrl: 'http://localhost:11434',
        ollamaModel: 'mistral',
      })
      const result = await provider.summarize('long article')
      expect(result).toBe('ollama output')
    })

    it('sets stream: false in the request body', async () => {
      const provider = createProvider({
        ...baseSettings,
        llmProvider: 'ollama',
        ollamaUrl: 'http://localhost:11434',
        ollamaModel: 'llama3.2',
      })
      await provider.simplify('text', 5)

      const body = JSON.parse(
        (vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string,
      ) as Record<string, unknown>
      expect(body.stream).toBe(false)
    })

    it('falls back to "llama3.2" when ollamaModel is not set', async () => {
      const provider = createProvider({
        ...baseSettings,
        llmProvider: 'ollama',
        ollamaUrl: 'http://localhost:11434',
        ollamaModel: undefined as unknown as string,
      })
      await provider.simplify('text', 5)

      const body = JSON.parse(
        (vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string,
      ) as Record<string, unknown>
      expect(body.model).toBe('llama3.2')
    })

    it('propagates network failures', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')))

      const provider = createProvider({
        ...baseSettings,
        llmProvider: 'ollama',
        ollamaUrl: 'http://localhost:11434',
        ollamaModel: 'llama3.2',
      })
      await expect(provider.simplify('text', 5)).rejects.toThrow('Network error')
    })
  })
})
