import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DEFAULT_SETTINGS } from '../../src/shared/types'

const { mockGetSettings, mockSetSettings } = vi.hoisted(() => ({
  mockGetSettings: vi.fn().mockResolvedValue({}),
  mockSetSettings: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../src/lib/storage', () => ({
  getSettings: mockGetSettings,
  setSettings: mockSetSettings,
}))

import {
  getProfiles,
  saveProfile,
  deleteProfile,
  loadProfile,
  exportProfiles,
  importProfiles,
  MAX_PROFILES,
} from '../../src/lib/profiles'
import type { Profile } from '../../src/shared/types'

function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: 'test-id-1',
    name: 'Test Profile',
    settings: { ttsRate: 1.5 },
    createdAt: 1000000,
    ...overrides,
  }
}

describe('profiles', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSettings.mockResolvedValue({ ...DEFAULT_SETTINGS })
    mockSetSettings.mockResolvedValue(undefined)
    // Default: no profiles stored
    vi.mocked(chrome.storage.sync.get).mockResolvedValue({})
    vi.mocked(chrome.storage.sync.set).mockResolvedValue(undefined)
  })

  describe('getProfiles', () => {
    it('returns empty array when no profiles are stored', async () => {
      vi.mocked(chrome.storage.sync.get).mockResolvedValue({})
      const result = await getProfiles()
      expect(result).toEqual([])
    })

    it('returns stored profiles', async () => {
      const stored = [makeProfile()]
      vi.mocked(chrome.storage.sync.get).mockResolvedValue({ clearpath_profiles: stored })
      const result = await getProfiles()
      expect(result).toEqual(stored)
    })
  })

  describe('saveProfile', () => {
    it('creates a profile with id, name, settings, and createdAt', async () => {
      vi.mocked(chrome.storage.sync.get).mockResolvedValue({})
      const profile = await saveProfile('My Profile')
      expect(typeof profile.id).toBe('string')
      expect(profile.name).toBe('My Profile')
      expect(profile.settings).toMatchObject({ ...DEFAULT_SETTINGS })
      expect(typeof profile.createdAt).toBe('number')
    })

    it('trims whitespace from the name', async () => {
      vi.mocked(chrome.storage.sync.get).mockResolvedValue({})
      const profile = await saveProfile('  My Profile  ')
      expect(profile.name).toBe('My Profile')
    })

    it('stores the new profile in chrome.storage.sync', async () => {
      vi.mocked(chrome.storage.sync.get).mockResolvedValue({})
      await saveProfile('My Profile')
      expect(chrome.storage.sync.set).toHaveBeenCalledWith(
        expect.objectContaining({ clearpath_profiles: expect.any(Array) }),
      )
    })

    it('appends to existing profiles', async () => {
      const existing = [makeProfile()]
      vi.mocked(chrome.storage.sync.get).mockResolvedValue({ clearpath_profiles: existing })
      await saveProfile('Second Profile')
      const stored = vi.mocked(chrome.storage.sync.set).mock.calls[0][0] as Record<string, Profile[]>
      expect(stored.clearpath_profiles).toHaveLength(2)
    })

    it(`throws when ${MAX_PROFILES} profiles are already stored`, async () => {
      const full = Array.from({ length: MAX_PROFILES }, (_, i) => makeProfile({ id: `id-${i}`, name: `Profile ${i}` }))
      vi.mocked(chrome.storage.sync.get).mockResolvedValue({ clearpath_profiles: full })
      await expect(saveProfile('Overflow')).rejects.toThrow(/maximum/i)
    })
  })

  describe('deleteProfile', () => {
    it('removes the profile with the given id', async () => {
      const stored = [makeProfile({ id: 'to-delete' }), makeProfile({ id: 'keep' })]
      vi.mocked(chrome.storage.sync.get).mockResolvedValue({ clearpath_profiles: stored })
      await deleteProfile('to-delete')
      const saved = vi.mocked(chrome.storage.sync.set).mock.calls[0][0] as Record<string, Profile[]>
      expect(saved.clearpath_profiles).toHaveLength(1)
      expect(saved.clearpath_profiles[0].id).toBe('keep')
    })

    it('is a no-op if the id is not found', async () => {
      const stored = [makeProfile({ id: 'existing' })]
      vi.mocked(chrome.storage.sync.get).mockResolvedValue({ clearpath_profiles: stored })
      await deleteProfile('nonexistent')
      const saved = vi.mocked(chrome.storage.sync.set).mock.calls[0][0] as Record<string, Profile[]>
      expect(saved.clearpath_profiles).toHaveLength(1)
    })
  })

  describe('loadProfile', () => {
    it('calls setSettings with the profile settings', async () => {
      const profile = makeProfile({ settings: { ttsRate: 0.8, ttsPitch: 1.2 } })
      await loadProfile(profile)
      expect(mockSetSettings).toHaveBeenCalledWith({ ttsRate: 0.8, ttsPitch: 1.2 })
    })
  })

  describe('exportProfiles', () => {
    it('triggers a JSON download with the profiles', () => {
      const mockCreateObjectURL = vi.fn().mockReturnValue('blob:fake-url')
      const mockRevokeObjectURL = vi.fn()
      const mockClick = vi.fn()
      vi.stubGlobal('URL', { createObjectURL: mockCreateObjectURL, revokeObjectURL: mockRevokeObjectURL })
      const mockAnchor = { href: '', download: '', click: mockClick } as unknown as HTMLAnchorElement
      vi.spyOn(document, 'createElement').mockImplementationOnce(() => mockAnchor)

      const profiles = [makeProfile()]
      exportProfiles(profiles)

      expect(mockCreateObjectURL).toHaveBeenCalledWith(expect.any(Blob))
      expect(mockAnchor.download).toBe('clearpath-profiles.json')
      expect(mockClick).toHaveBeenCalled()
      expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:fake-url')

      vi.unstubAllGlobals()
      vi.restoreAllMocks()
    })
  })

  describe('importProfiles', () => {
    it('imports valid profiles from JSON', async () => {
      vi.mocked(chrome.storage.sync.get).mockResolvedValue({})
      const profiles = [makeProfile()]
      const json = JSON.stringify(profiles)
      const result = await importProfiles(json)
      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('Test Profile')
    })

    it('throws on invalid JSON', async () => {
      await expect(importProfiles('not-json')).rejects.toThrow('Invalid JSON')
    })

    it('throws when JSON is not an array', async () => {
      await expect(importProfiles('{"name":"x"}')).rejects.toThrow(/array/i)
    })

    it('throws when no valid profiles are found', async () => {
      await expect(importProfiles('[{"noName":true}]')).rejects.toThrow(/no valid profiles/i)
    })

    it('merges with existing profiles', async () => {
      const existing = [makeProfile({ id: 'existing', name: 'Existing' })]
      vi.mocked(chrome.storage.sync.get).mockResolvedValue({ clearpath_profiles: existing })
      const toImport = [makeProfile({ id: 'new', name: 'Imported' })]
      const result = await importProfiles(JSON.stringify(toImport))
      expect(result).toHaveLength(2)
    })

    it(`respects the ${MAX_PROFILES} profile cap`, async () => {
      const full = Array.from({ length: MAX_PROFILES - 1 }, (_, i) =>
        makeProfile({ id: `id-${i}`, name: `Profile ${i}` }),
      )
      vi.mocked(chrome.storage.sync.get).mockResolvedValue({ clearpath_profiles: full })
      const toImport = [
        makeProfile({ id: 'new-1', name: 'New 1' }),
        makeProfile({ id: 'new-2', name: 'New 2' }),
      ]
      const result = await importProfiles(JSON.stringify(toImport))
      expect(result).toHaveLength(MAX_PROFILES)
    })

    it('assigns id and createdAt to imported profiles missing those fields', async () => {
      vi.mocked(chrome.storage.sync.get).mockResolvedValue({})
      const json = JSON.stringify([{ name: 'No ID Profile', settings: { ttsRate: 1.0 } }])
      const result = await importProfiles(json)
      expect(typeof result[0].id).toBe('string')
      expect(typeof result[0].createdAt).toBe('number')
    })
  })
})
