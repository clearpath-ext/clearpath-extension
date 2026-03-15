import type { Settings, Profile } from '../shared/types'
import { DEFAULT_SETTINGS } from '../shared/types'

export async function getSettings(): Promise<Settings> {
  const result = await chrome.storage.sync.get('settings')
  return { ...DEFAULT_SETTINGS, ...(result.settings ?? {}) }
}

export async function setSettings(patch: Partial<Settings>): Promise<void> {
  const current = await getSettings()
  await chrome.storage.sync.set({ settings: { ...current, ...patch } })
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
  const listener = (changes: Record<string, chrome.storage.StorageChange>) => {
    if ('settings' in changes) {
      callback({ ...DEFAULT_SETTINGS, ...changes['settings'].newValue })
    }
  }
  chrome.storage.onChanged.addListener(listener)
  return () => chrome.storage.onChanged.removeListener(listener)
}
