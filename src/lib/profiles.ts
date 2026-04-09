// Named accessibility profiles — save, load, delete, export, and import
// all user settings as a named snapshot stored in chrome.storage.sync.

import { getSettings, setSettings } from './storage'
import type { Profile, Settings } from '../shared/types'

const PROFILES_KEY = 'clearpath_profiles'
export const MAX_PROFILES = 10

// ── Internal helpers ──────────────────────────────────────────────────────────

async function readProfiles(): Promise<Profile[]> {
  const result = await chrome.storage.sync.get(PROFILES_KEY)
  return (result[PROFILES_KEY] as Profile[] | undefined) ?? []
}

async function writeProfiles(profiles: Profile[]): Promise<void> {
  await chrome.storage.sync.set({ [PROFILES_KEY]: profiles })
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function getProfiles(): Promise<Profile[]> {
  console.debug('[ClearPath] Profiles: getProfiles')
  return readProfiles()
}

export async function saveProfile(name: string): Promise<Profile> {
  const profiles = await readProfiles()
  if (profiles.length >= MAX_PROFILES) {
    throw new Error(`Maximum of ${MAX_PROFILES} profiles reached`)
  }
  const settings = await getSettings()
  const profile: Profile = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: name.trim(),
    settings,
    createdAt: Date.now(),
  }
  profiles.push(profile)
  await writeProfiles(profiles)
  console.debug('[ClearPath] Profiles: saved —', profile.name)
  return profile
}

export async function deleteProfile(id: string): Promise<void> {
  const profiles = await readProfiles()
  await writeProfiles(profiles.filter((p) => p.id !== id))
  console.debug('[ClearPath] Profiles: deleted id —', id)
}

export async function loadProfile(profile: Profile): Promise<void> {
  await setSettings(profile.settings as Partial<Settings>)
  console.debug('[ClearPath] Profiles: loaded —', profile.name)
}

export function exportProfiles(profiles: Profile[]): void {
  const json = JSON.stringify(profiles, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'clearpath-profiles.json'
  a.click()
  URL.revokeObjectURL(url)
  console.debug('[ClearPath] Profiles: exported', profiles.length, 'profiles')
}

export async function importProfiles(json: string): Promise<Profile[]> {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    throw new Error('Invalid JSON')
  }
  if (!Array.isArray(parsed)) throw new Error('Expected an array of profiles')

  const valid = (parsed as Record<string, unknown>[]).filter(
    (p) => p && typeof p === 'object' && typeof p.name === 'string' && p.settings !== undefined,
  )
  if (valid.length === 0) throw new Error('No valid profiles found')

  const existing = await readProfiles()
  const merged = [...existing]
  let added = 0
  for (const p of valid) {
    if (merged.length >= MAX_PROFILES) break
    merged.push({
      id: typeof p.id === 'string' ? p.id : `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: p.name as string,
      settings: p.settings as Partial<Settings>,
      createdAt: typeof p.createdAt === 'number' ? p.createdAt : Date.now(),
    })
    added++
  }
  await writeProfiles(merged)
  console.debug('[ClearPath] Profiles: imported', added, 'profiles')
  return merged
}
