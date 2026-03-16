import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DEFAULT_SETTINGS } from '../../src/shared/types'

// Mock storage and llm before the module is imported
const { mockGetSettings, mockCreateProvider } = vi.hoisted(() => ({
  mockGetSettings: vi.fn(),
  mockCreateProvider: vi.fn(),
}))

vi.mock('../../src/lib/storage', () => ({ getSettings: mockGetSettings }))
vi.mock('../../src/lib/llm', () => ({ createProvider: mockCreateProvider }))

// Import the module — registers listeners on the chrome mocks at module load time
import '../../src/background/service-worker'

// Capture listener references before any beforeEach can call vi.clearAllMocks()
type MessageListener = (
  msg: Record<string, unknown>,
  sender: unknown,
  sendResponse: (r: unknown) => void,
) => boolean | void

const installedListener = vi.mocked(chrome.runtime.onInstalled.addListener).mock.calls[0]
  ?.[0] as ((details: unknown) => void) | undefined

const messageListener = vi.mocked(chrome.runtime.onMessage.addListener).mock.calls[0]
  ?.[0] as MessageListener | undefined

const contextMenuClickListener = vi.mocked(chrome.contextMenus.onClicked.addListener).mock
  .calls[0]?.[0] as
  | ((info: chrome.contextMenus.OnClickData, tab?: chrome.tabs.Tab) => void)
  | undefined

describe('service-worker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Restore removeAll callback behaviour after clearAllMocks resets it
    vi.mocked(chrome.contextMenus.removeAll).mockImplementation((cb?: () => void) => cb?.())
    chrome.runtime.lastError = null
  })

  describe('onInstalled', () => {
    it('registers a listener', () => {
      expect(installedListener).toBeTypeOf('function')
    })

    it('clears existing menus then creates both Read Aloud and Simplify context menu items', () => {
      installedListener?.({})
      expect(chrome.contextMenus.removeAll).toHaveBeenCalledOnce()
      expect(chrome.contextMenus.create).toHaveBeenCalledWith({
        id: 'clearpath-read-aloud',
        title: 'Read Aloud',
        contexts: ['selection'],
      })
      expect(chrome.contextMenus.create).toHaveBeenCalledWith({
        id: 'clearpath-simplify',
        title: 'Simplify',
        contexts: ['selection'],
      })
    })
  })

  describe('context menu click', () => {
    it('sends TTS_SPEAK_SELECTION to the clicked tab', () => {
      contextMenuClickListener?.(
        { menuItemId: 'clearpath-read-aloud' } as chrome.contextMenus.OnClickData,
        { id: 42 } as chrome.tabs.Tab,
      )
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(42, { type: 'TTS_SPEAK_SELECTION' })
    })

    it('does nothing if the menu item ID does not match', () => {
      contextMenuClickListener?.(
        { menuItemId: 'some-other-menu' } as chrome.contextMenus.OnClickData,
        { id: 42 } as chrome.tabs.Tab,
      )
      expect(chrome.tabs.sendMessage).not.toHaveBeenCalled()
    })

    it('does nothing if tab id is missing', () => {
      contextMenuClickListener?.(
        { menuItemId: 'clearpath-read-aloud' } as chrome.contextMenus.OnClickData,
        {} as chrome.tabs.Tab,
      )
      expect(chrome.tabs.sendMessage).not.toHaveBeenCalled()
    })
  })

  describe('Simplify context menu', () => {
    it('sends SIMPLIFY_LOADING then SIMPLIFY_RESULT on successful LLM call', async () => {
      const mockSimplify = vi.fn().mockResolvedValue('simplified text')
      mockCreateProvider.mockReturnValue({ simplify: mockSimplify, summarize: vi.fn() })
      mockGetSettings.mockResolvedValue({ ...DEFAULT_SETTINGS, readingLevel: 5 })

      contextMenuClickListener?.(
        {
          menuItemId: 'clearpath-simplify',
          selectionText: 'complex text',
        } as chrome.contextMenus.OnClickData,
        { id: 42 } as chrome.tabs.Tab,
      )

      // SIMPLIFY_LOADING is sent synchronously before the async work
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(42, { type: 'SIMPLIFY_LOADING' })

      await new Promise((r) => setTimeout(r, 10))

      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(42, {
        type: 'SIMPLIFY_RESULT',
        payload: { simplified: 'simplified text' },
      })
    })

    it('sends SIMPLIFY_LOADING then SIMPLIFY_ERROR on LLM failure', async () => {
      const mockSimplify = vi.fn().mockRejectedValue(new Error('API failed'))
      mockCreateProvider.mockReturnValue({ simplify: mockSimplify, summarize: vi.fn() })
      mockGetSettings.mockResolvedValue({ ...DEFAULT_SETTINGS })

      contextMenuClickListener?.(
        {
          menuItemId: 'clearpath-simplify',
          selectionText: 'some text',
        } as chrome.contextMenus.OnClickData,
        { id: 42 } as chrome.tabs.Tab,
      )

      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(42, { type: 'SIMPLIFY_LOADING' })

      await new Promise((r) => setTimeout(r, 10))

      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(42, {
        type: 'SIMPLIFY_ERROR',
        payload: { error: 'Error: API failed' },
      })
    })

    it('is a no-op when selectionText is empty', async () => {
      contextMenuClickListener?.(
        {
          menuItemId: 'clearpath-simplify',
          selectionText: '   ',
        } as chrome.contextMenus.OnClickData,
        { id: 42 } as chrome.tabs.Tab,
      )

      await new Promise((r) => setTimeout(r, 10))

      expect(chrome.tabs.sendMessage).not.toHaveBeenCalled()
    })
  })

  describe('message routing', () => {
    it('returns true for TTS_ACTION to keep the message channel open', () => {
      vi.mocked(chrome.tabs.query).mockResolvedValue([{ id: 1 }] as chrome.tabs.Tab[])
      const result = messageListener?.(
        { type: 'TTS_ACTION', payload: { action: 'pause' } },
        {},
        vi.fn(),
      )
      expect(result).toBe(true)
    })

    it('forwards TTS_ACTION to the active tab and relays the response', async () => {
      vi.mocked(chrome.tabs.query).mockResolvedValue([{ id: 5 }] as chrome.tabs.Tab[])
      vi.mocked(chrome.tabs.sendMessage).mockImplementation(
        (_id, _msg, cb?: (r: unknown) => void) => {
          cb?.({ ok: true, data: undefined })
          return undefined as unknown as number
        },
      )

      const sendResponse = vi.fn()
      messageListener?.({ type: 'TTS_ACTION', payload: { action: 'stop' } }, {}, sendResponse)
      await new Promise((r) => setTimeout(r, 0))

      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
        5,
        expect.objectContaining({ type: 'TTS_ACTION' }),
        expect.any(Function),
      )
      expect(sendResponse).toHaveBeenCalledWith({ ok: true, data: undefined })
    })

    it('responds with error when no active tab is found', async () => {
      vi.mocked(chrome.tabs.query).mockResolvedValue([])

      const sendResponse = vi.fn()
      messageListener?.({ type: 'TTS_SPEAK_PAGE' }, {}, sendResponse)
      await new Promise((r) => setTimeout(r, 0))

      expect(sendResponse).toHaveBeenCalledWith({ ok: false, error: 'No active tab' })
    })

    it('responds with error when the content script is unavailable', async () => {
      vi.mocked(chrome.tabs.query).mockResolvedValue([{ id: 7 }] as chrome.tabs.Tab[])
      vi.mocked(chrome.tabs.sendMessage).mockImplementation(
        (_id, _msg, cb?: (r: unknown) => void) => {
          chrome.runtime.lastError = { message: 'Could not establish connection' }
          cb?.(undefined)
          return undefined as unknown as number
        },
      )

      const sendResponse = vi.fn()
      messageListener?.({ type: 'GET_TTS_STATE' }, {}, sendResponse)
      await new Promise((r) => setTimeout(r, 0))

      expect(sendResponse).toHaveBeenCalledWith({
        ok: false,
        error: 'Could not establish connection',
      })
    })

    it('forwards TTS_STATE_CHANGED to the runtime (popup)', () => {
      vi.mocked(chrome.runtime.sendMessage).mockResolvedValue(undefined)

      messageListener?.(
        { type: 'TTS_STATE_CHANGED', payload: { state: 'playing' } },
        {},
        vi.fn(),
      )

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'TTS_STATE_CHANGED',
        payload: { state: 'playing' },
      })
    })

    it('swallows sendMessage rejection for TTS_STATE_CHANGED (popup may be closed)', async () => {
      vi.mocked(chrome.runtime.sendMessage).mockRejectedValue(new Error('popup closed'))

      expect(() =>
        messageListener?.(
          { type: 'TTS_STATE_CHANGED', payload: { state: 'playing' } },
          {},
          vi.fn(),
        ),
      ).not.toThrow()

      // Let the rejected promise settle without uncaught rejection
      await new Promise((r) => setTimeout(r, 0))
    })
  })
})
