import type { Settings } from '../types';

const DRAFT_KEY = 'claude-mem-settings-draft-v1';

/** Credentials never touch browser storage, even as an unsaved edit. */
function isSecretKey(key: string): boolean {
  return /API_KEY|TOKEN|SECRET|PASSWORD/i.test(key);
}

/** Unsaved, non-secret edits from an earlier visit, or null. */
export function readSettingsDraft(): Partial<Settings> | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const draft: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === 'string' && !isSecretKey(key)) draft[key] = value;
    }
    return Object.keys(draft).length ? (draft as Partial<Settings>) : null;
  } catch {
    return null;
  }
}

function savedValue(saved: Settings, key: string): unknown {
  return (saved as unknown as Record<string, unknown>)[key];
}

/** Fields of `draft` that still differ from the saved settings. */
export function pendingDraftFields(draft: Partial<Settings> | null, saved: Settings): Partial<Settings> {
  const pending: Record<string, string> = {};
  if (!draft) return pending as Partial<Settings>;
  for (const [key, value] of Object.entries(draft)) {
    if (value !== savedValue(saved, key)) pending[key] = value as string;
  }
  return pending as Partial<Settings>;
}

/** Keeps the form's unsaved, non-secret edits; clears the draft once nothing differs. */
export function writeSettingsDraft(form: Settings, saved: Settings): void {
  const changed: Record<string, string> = {};
  for (const [key, value] of Object.entries(form)) {
    if (isSecretKey(key) || typeof value !== 'string') continue;
    if (value !== savedValue(saved, key)) changed[key] = value;
  }
  try {
    if (Object.keys(changed).length) localStorage.setItem(DRAFT_KEY, JSON.stringify(changed));
    else localStorage.removeItem(DRAFT_KEY);
  } catch {
    // Storage blocked (private window): drafts are a convenience, not state.
  }
}

export function clearSettingsDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // Storage blocked: nothing was kept.
  }
}
