import type { Settings, Profile } from '../shared/types'
import { DEFAULT_SETTINGS } from '../shared/types'

// The API key stays on this device (chrome.storage.local). Everything else
// lives in chrome.storage.sync and follows the user's browser account.
const API_KEY = 'apiKey'

type SyncedSettings = Partial<Omit<Settings, 'apiKey'>> & { apiKey?: string }

async function readSynced(): Promise<SyncedSettings> {
  const result = await chrome.storage.sync.get('settings')
  return { ...(result.settings ?? {}) }
}

export async function getSettings(): Promise<Settings> {
  const synced = await readSynced()
  const local = await chrome.storage.local.get(API_KEY)
  let apiKey: string = typeof local[API_KEY] === 'string' ? local[API_KEY] : ''

  // Older versions kept the key in sync storage. Move it to this device once.
  if ('apiKey' in synced) {
    if (!apiKey && synced.apiKey) {
      apiKey = synced.apiKey
      await chrome.storage.local.set({ [API_KEY]: apiKey })
    }
    delete synced.apiKey
    await chrome.storage.sync.set({ settings: synced })
  }

  return { ...DEFAULT_SETTINGS, ...synced, apiKey }
}

export async function setSettings(patch: Partial<Settings>): Promise<void> {
  const { apiKey, ...rest } = patch
  if (apiKey !== undefined) await chrome.storage.local.set({ [API_KEY]: apiKey })
  if (Object.keys(rest).length === 0) return
  const { apiKey: _local, ...current } = await getSettings()
  await chrome.storage.sync.set({ settings: { ...current, ...rest } })
}

export async function getProfiles(): Promise<Profile[]> {
  const result = await chrome.storage.sync.get('profiles')
  return result.profiles ?? []
}

export async function saveProfile(profile: Profile): Promise<void> {
  const profiles = await getProfiles()
  const index = profiles.findIndex((p) => p.name === profile.name)
  if (index >= 0) {
    profiles[index] = profile
  } else {
    profiles.push(profile)
  }
  await chrome.storage.sync.set({ profiles })
}

export async function deleteProfile(name: string): Promise<void> {
  const profiles = await getProfiles()
  await chrome.storage.sync.set({ profiles: profiles.filter((p) => p.name !== name) })
}

export function onSettingsChanged(callback: (settings: Settings) => void): () => void {
  const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    const synced = area === 'sync' && 'settings' in changes
    const key = area === 'local' && API_KEY in changes
    if (synced || key) void getSettings().then(callback)
  }
  chrome.storage.onChanged.addListener(listener)
  return () => chrome.storage.onChanged.removeListener(listener)
}
