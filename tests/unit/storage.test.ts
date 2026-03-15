import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getSettings,
  setSettings,
  getProfiles,
  saveProfile,
  deleteProfile,
  onSettingsChanged,
} from '../../src/lib/storage'
import { DEFAULT_SETTINGS } from '../../src/shared/types'

describe('storage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getSettings', () => {
    it('returns DEFAULT_SETTINGS when storage is empty', async () => {
      vi.mocked(chrome.storage.sync.get).mockResolvedValue({})
      expect(await getSettings()).toEqual(DEFAULT_SETTINGS)
    })

    it('merges stored values over defaults', async () => {
      vi.mocked(chrome.storage.sync.get).mockResolvedValue({
        settings: { ttsRate: 1.5, ttsVoice: 'Google US English' },
      })
      const result = await getSettings()
      expect(result.ttsRate).toBe(1.5)
      expect(result.ttsVoice).toBe('Google US English')
      expect(result.ttsPitch).toBe(DEFAULT_SETTINGS.ttsPitch)
    })
  })

  describe('setSettings', () => {
    it('merges patch into current settings and saves', async () => {
      vi.mocked(chrome.storage.sync.get).mockResolvedValue({
        settings: { ...DEFAULT_SETTINGS, ttsRate: 1.2 },
      })
      vi.mocked(chrome.storage.sync.set).mockResolvedValue(undefined)

      await setSettings({ ttsPitch: 0.8 })

      expect(chrome.storage.sync.set).toHaveBeenCalledWith({
        settings: expect.objectContaining({ ttsRate: 1.2, ttsPitch: 0.8 }),
      })
    })
  })

  describe('getProfiles', () => {
    it('returns empty array when no profiles exist', async () => {
      vi.mocked(chrome.storage.sync.get).mockResolvedValue({})
      expect(await getProfiles()).toEqual([])
    })

    it('returns stored profiles', async () => {
      const profiles = [{ name: 'Dyslexia', settings: { ttsRate: 0.8 } }]
      vi.mocked(chrome.storage.sync.get).mockResolvedValue({ profiles })
      expect(await getProfiles()).toEqual(profiles)
    })
  })

  describe('saveProfile', () => {
    beforeEach(() => {
      vi.mocked(chrome.storage.sync.set).mockResolvedValue(undefined)
    })

    it('appends a new profile', async () => {
      vi.mocked(chrome.storage.sync.get).mockResolvedValue({ profiles: [] })
      await saveProfile({ name: 'AAC', settings: {} })
      expect(chrome.storage.sync.set).toHaveBeenCalledWith({
        profiles: [{ name: 'AAC', settings: {} }],
      })
    })

    it('replaces an existing profile with the same name', async () => {
      vi.mocked(chrome.storage.sync.get).mockResolvedValue({
        profiles: [{ name: 'AAC', settings: { ttsRate: 1.0 } }],
      })
      await saveProfile({ name: 'AAC', settings: { ttsRate: 1.5 } })
      expect(chrome.storage.sync.set).toHaveBeenCalledWith({
        profiles: [{ name: 'AAC', settings: { ttsRate: 1.5 } }],
      })
    })
  })

  describe('deleteProfile', () => {
    it('removes the named profile and keeps others', async () => {
      vi.mocked(chrome.storage.sync.get).mockResolvedValue({
        profiles: [
          { name: 'AAC', settings: {} },
          { name: 'Reading', settings: {} },
        ],
      })
      vi.mocked(chrome.storage.sync.set).mockResolvedValue(undefined)

      await deleteProfile('AAC')

      expect(chrome.storage.sync.set).toHaveBeenCalledWith({
        profiles: [{ name: 'Reading', settings: {} }],
      })
    })
  })

  describe('onSettingsChanged', () => {
    it('calls callback when the settings key changes', () => {
      const callback = vi.fn()
      onSettingsChanged(callback)
      const listener = vi.mocked(chrome.storage.onChanged.addListener).mock.calls[0][0]

      listener({ settings: { newValue: { ...DEFAULT_SETTINGS, ttsRate: 1.8 } } }, 'sync')

      expect(callback).toHaveBeenCalledWith(expect.objectContaining({ ttsRate: 1.8 }))
    })

    it('does not call callback for unrelated key changes', () => {
      const callback = vi.fn()
      onSettingsChanged(callback)
      const listener = vi.mocked(chrome.storage.onChanged.addListener).mock.calls[0][0]

      listener({ profiles: { newValue: [] } }, 'sync')

      expect(callback).not.toHaveBeenCalled()
    })

    it('returns a cleanup function that removes the listener', () => {
      const cleanup = onSettingsChanged(vi.fn())
      cleanup()
      expect(chrome.storage.onChanged.removeListener).toHaveBeenCalled()
    })
  })
})
