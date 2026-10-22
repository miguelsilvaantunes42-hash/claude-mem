import React, { useState, useCallback, useEffect, useId, useRef } from 'react';
import type { Settings } from '../types';
import { TerminalPreview } from './TerminalPreview';
import { useContextPreview } from '../hooks/useContextPreview';
import { DEFAULT_SETTINGS } from '../constants/settings';
import { isClaudeMemObserverBaseUrl } from '../utils/observer-endpoint';
import { claudeProviderOptionLabel } from '../utils/claude-auth-method';
import { OPENAI_COMPAT_PRESET_OPTIONS, openAICompatPresetOption } from '../constants/openai-compat-presets';
import { readSettingsDraft, pendingDraftFields, writeSettingsDraft, clearSettingsDraft } from '../utils/settings-draft';
import { ErrorNotice } from './ErrorNotice';

interface ContextSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: Settings;
  /** False until GET /api/settings succeeds; `settings` holds defaults until then. */
  isLoaded: boolean;
  /** Why the initial GET failed, or null. */
  loadError: string | null;
  onRetryLoad: () => void;
  onSave: (settings: Settings) => void;
  isSaving: boolean;
  saveStatus: string;
}

export function saveStatusClass(saveStatus: string): string {
  return saveStatus.includes('✗') ? 'error' : saveStatus.includes('✓') ? 'success' : '';
}

type SectionId = 'loading' | 'display' | 'advanced';

const SECTIONS: { id: SectionId; title: string }[] = [
  { id: 'loading', title: 'Loading' },
  { id: 'display', title: 'Display' },
  { id: 'advanced', title: 'Advanced' },
];

function CollapsibleSection({
  id,
  title,
  description,
  children,
  isOpen,
  onToggle,
}: {
  id: SectionId;
  title: string;
  description?: string;
  children: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const contentId = `settings-section-${id}`;
  return (
    <section id={`settings-${id}`} className={`settings-section-collapsible ${isOpen ? 'open' : ''}`} aria-labelledby={`${contentId}-title`}>
      <button
        className="section-header-btn"
        onClick={onToggle}
        type="button"
        aria-expanded={isOpen}
        aria-controls={contentId}
      >
        <span className="section-header-content">
          <span className="section-title" id={`${contentId}-title`}>{title}</span>
          {description && <span className="section-description">{description}</span>}
        </span>
        <svg
          className={`chevron-icon ${isOpen ? 'rotated' : ''}`}
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {isOpen && <div className="section-content" id={contentId}>{children}</div>}
    </section>
  );
}

/**
 * Label, control, optional help, and a blur-time error. The label is bound to
 * the first input/select child; help sits behind a button instead of a hover
 * title so keyboard and touch users can read it.
 */
function FormField({
  label,
  tooltip,
  error,
  children
}: {
  label: string;
  tooltip?: string;
  error?: string | null;
  children: React.ReactNode;
}) {
  const id = useId();
  const [showHelp, setShowHelp] = useState(false);
  const helpId = `${id}-help`;
  const errorId = `${id}-error`;
  const describedBy = [showHelp && tooltip ? helpId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;
  let bound = false;
  const controls = React.Children.map(children, child => {
    if (bound || !React.isValidElement(child) || (child.type !== 'input' && child.type !== 'select')) return child;
    bound = true;
    const element = child as React.ReactElement<React.InputHTMLAttributes<HTMLInputElement>>;
    return React.cloneElement(element, {
      id,
      'aria-describedby': describedBy,
      'aria-invalid': error ? true : undefined,
    });
  });

  return (
    <div className={`form-field${error ? ' form-field--invalid' : ''}`}>
      <label className="form-field-label" htmlFor={id}>{label}</label>
      {tooltip && (
        <button
          type="button"
          className="icon-btn icon-btn--small form-field-help-btn"
          aria-label={`About ${label}`}
          aria-expanded={showHelp}
          data-tooltip={showHelp ? 'Hide help' : 'Show help'}
          onClick={() => setShowHelp(prev => !prev)}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </button>
      )}
      {showHelp && tooltip && <p className="form-field-help" id={helpId}>{tooltip}</p>}
      {controls}
      {error && <p className="form-field-error" id={errorId}>{error}</p>}
    </div>
  );
}

/** Whole-number fields and their allowed ranges. */
const NUMBER_RULES: Partial<Record<keyof Settings, { min: number; max: number }>> = {
  CLAUDE_MEM_CONTEXT_OBSERVATIONS: { min: 1, max: 200 },
  CLAUDE_MEM_CONTEXT_SESSION_COUNT: { min: 1, max: 50 },
  CLAUDE_MEM_CONTEXT_FULL_COUNT: { min: 0, max: 20 },
  CLAUDE_MEM_WORKER_PORT: { min: 1024, max: 65535 },
};

export function numberFieldError(key: keyof Settings, value: string | undefined): string | null {
  const rule = NUMBER_RULES[key];
  if (!rule) return null;
  const text = (value ?? '').trim();
  const n = Number(text);
  if (text === '' || !Number.isInteger(n) || n < rule.min || n > rule.max) {
    return `Enter a whole number from ${rule.min} to ${rule.max}.`;
  }
  return null;
}

function ToggleSwitch({
  id,
  label,
  description,
  checked,
  onChange,
  disabled
}: {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="toggle-row">
      <div className="toggle-info">
        <label htmlFor={id} className="toggle-label">{label}</label>
        {description && <span className="toggle-description">{description}</span>}
      </div>
      <button
        type="button"
        id={id}
        role="switch"
        aria-checked={checked}
        className={`toggle-switch ${checked ? 'on' : ''} ${disabled ? 'disabled' : ''}`}
        onClick={() => !disabled && onChange(!checked)}
        disabled={disabled}
      >
        <span className="toggle-knob" />
      </button>
    </div>
  );
}

export function ContextSettingsModal({
  isOpen,
  onClose,
  settings,
  isLoaded,
  loadError,
  onRetryLoad,
  onSave,
  isSaving,
  saveStatus
}: ContextSettingsModalProps) {
  const [formState, setFormState] = useState<Settings>(settings);
  const [errors, setErrors] = useState<Partial<Record<keyof Settings, string>>>({});
  const [openSections, setOpenSections] = useState<Record<SectionId, boolean>>({ loading: true, display: true, advanced: false });
  const [draftRestored, setDraftRestored] = useState(false);
  const [blockedNotice, setBlockedNotice] = useState<string | null>(null);
  const formRef = useRef<HTMLFieldSetElement>(null);
  // From the saved settings, not the form: the field stays editable while a
  // user types any other URL, and read-only for the observer's own endpoint.
  const observerManagesBaseUrl = isClaudeMemObserverBaseUrl(settings.CLAUDE_MEM_OPENROUTER_BASE_URL);

  // Unsaved edits from an earlier visit come back on top of the loaded
  // settings; secrets are never kept, so they always start from the file.
  useEffect(() => {
    if (!isLoaded) {
      setFormState(settings);
      return;
    }
    const pending = pendingDraftFields(readSettingsDraft(), settings);
    setFormState({ ...settings, ...pending });
    setDraftRestored(Object.keys(pending).length > 0);
  }, [settings, isLoaded]);

  useEffect(() => {
    if (isLoaded) writeSettingsDraft(formState, settings);
  }, [formState, settings, isLoaded]);

  useEffect(() => {
    if (isLoaded) setBlockedNotice(null);
  }, [isLoaded]);

  const discardDraft = useCallback(() => {
    clearSettingsDraft();
    setFormState(settings);
    setErrors({});
    setDraftRestored(false);
  }, [settings]);

  const toggleSection = useCallback((id: SectionId) => {
    setOpenSections(prev => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const jumpToSection = useCallback((id: SectionId) => {
    setOpenSections(prev => ({ ...prev, [id]: true }));
    requestAnimationFrame(() => {
      const section = document.getElementById(`settings-${id}`);
      section?.scrollIntoView({ block: 'start' });
      section?.querySelector<HTMLButtonElement>('.section-header-btn')?.focus({ preventScroll: true });
    });
  }, []);

  const {
    preview,
    isLoading,
    error,
    projects,
    sources,
    selectedSource,
    setSelectedSource,
    selectedProject,
    setSelectedProject
  } = useContextPreview(formState);

  const updateSetting = useCallback((key: keyof Settings, value: string) => {
    const newState = { ...formState, [key]: value };
    setFormState(newState);
    // An error clears on the first corrective keystroke, not on the next blur.
    setErrors(prev => (prev[key] && !numberFieldError(key, value) ? { ...prev, [key]: undefined } : prev));
  }, [formState]);

  /** Validation fires when a number field is left, never while typing. */
  const numberField = (key: keyof Settings) => ({
    onBlur: (e: React.FocusEvent<HTMLInputElement>) => {
      const message = numberFieldError(key, e.target.value);
      setErrors(prev => ({ ...prev, [key]: message ?? undefined }));
    },
  });

  const handleSave = useCallback(() => {
    if (isSaving) return;
    if (!isLoaded) {
      setBlockedNotice(loadError ? null : 'Save works once your saved settings finish loading.');
      return;
    }
    const nextErrors: Partial<Record<keyof Settings, string>> = {};
    for (const key of Object.keys(NUMBER_RULES) as (keyof Settings)[]) {
      const message = numberFieldError(key, formState[key]);
      if (message) nextErrors[key] = message;
    }
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      if (nextErrors.CLAUDE_MEM_WORKER_PORT) setOpenSections(prev => ({ ...prev, advanced: true }));
      requestAnimationFrame(() => {
        const invalid = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
        invalid?.scrollIntoView({ block: 'center' });
        invalid?.focus();
      });
      return;
    }
    onSave(formState);
  }, [formState, onSave, isSaving, isLoaded, loadError]);

  const toggleBoolean = useCallback((key: keyof Settings) => {
    const currentValue = formState[key];
    const newValue = currentValue === 'true' ? 'false' : 'true';
    updateSetting(key, newValue);
  }, [formState, updateSetting]);

  if (!isOpen) return null;

  return (
    <div className="settings-page context-settings-modal">
      <div className="settings-page-inner">
        <div className="settings-page-header">
          <div>
            <h2 className="page-title">Settings</h2>
            <p className="page-description">Choose what claude-mem injects when a session starts and which model writes your observations.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary modal-close-btn"
          >
            Close settings
          </button>
        </div>

        <div className="settings-layout">
          <nav className="settings-nav" aria-label="Settings sections">
            {SECTIONS.map(section => (
              <button key={section.id} type="button" className="settings-nav-item" onClick={() => jumpToSection(section.id)}>
                {section.title}
              </button>
            ))}
          </nav>

          <div className="settings-form">
            {draftRestored && (
              <div className="settings-draft-notice" role="status">
                <span>Unsaved changes from your last visit are restored.</span>
                <button type="button" className="btn btn-quiet" onClick={discardDraft}>Discard changes</button>
              </div>
            )}
          {/* Right column - Settings Panel. Before the initial load the form
              holds defaults; saving them would overwrite settings.json. */}
          <fieldset ref={formRef} className="settings-column" disabled={isSaving || !isLoaded}
            style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
            <legend className="visually-hidden">Settings</legend>
            {/* Section 1: Loading */}
            <CollapsibleSection
              id="loading"
              title="Loading"
              description="How many observations to inject"
              isOpen={openSections.loading}
              onToggle={() => toggleSection('loading')}
            >
              <FormField
                label="Observations"
                  error={errors.CLAUDE_MEM_CONTEXT_OBSERVATIONS}
                tooltip="Number of recent observations to include in context (1-200)"
              >
                <input
                  type="number"
                  min="1"
                  max="200"
                  value={formState.CLAUDE_MEM_CONTEXT_OBSERVATIONS || DEFAULT_SETTINGS.CLAUDE_MEM_CONTEXT_OBSERVATIONS}
                  {...numberField('CLAUDE_MEM_CONTEXT_OBSERVATIONS')}
                  onChange={(e) => updateSetting('CLAUDE_MEM_CONTEXT_OBSERVATIONS', e.target.value || DEFAULT_SETTINGS.CLAUDE_MEM_CONTEXT_OBSERVATIONS)}
                />
              </FormField>
              <ToggleSwitch
                id="session-start-all-sources"
                label="Include all sources at session start"
                description="Show observations from Claude, Codex, and other harnesses in startup context"
                checked={formState.CLAUDE_MEM_SESSION_START_INCLUDE_ALL_SOURCES === 'true'}
                onChange={() => toggleBoolean('CLAUDE_MEM_SESSION_START_INCLUDE_ALL_SOURCES')}
              />
              <FormField
                label="Sessions"
                  error={errors.CLAUDE_MEM_CONTEXT_SESSION_COUNT}
                tooltip="Number of recent sessions to pull observations from (1-50)"
              >
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={formState.CLAUDE_MEM_CONTEXT_SESSION_COUNT || DEFAULT_SETTINGS.CLAUDE_MEM_CONTEXT_SESSION_COUNT}
                  {...numberField('CLAUDE_MEM_CONTEXT_SESSION_COUNT')}
                  onChange={(e) => updateSetting('CLAUDE_MEM_CONTEXT_SESSION_COUNT', e.target.value || DEFAULT_SETTINGS.CLAUDE_MEM_CONTEXT_SESSION_COUNT)}
                />
              </FormField>
            </CollapsibleSection>

            {/* Section 2: Display */}
            <CollapsibleSection
              id="display"
              title="Display"
              description="What to show in context tables"
              isOpen={openSections.display}
              onToggle={() => toggleSection('display')}
            >
              <div className="display-subsection">
                <h4 className="subsection-label">Full observations</h4>
                <FormField
                  label="Count"
                  error={errors.CLAUDE_MEM_CONTEXT_FULL_COUNT}
                  tooltip="How many observations show expanded details (0-20)"
                >
                  <input
                    type="number"
                    min="0"
                    max="20"
                    value={formState.CLAUDE_MEM_CONTEXT_FULL_COUNT || DEFAULT_SETTINGS.CLAUDE_MEM_CONTEXT_FULL_COUNT}
                    {...numberField('CLAUDE_MEM_CONTEXT_FULL_COUNT')}
                  onChange={(e) => updateSetting('CLAUDE_MEM_CONTEXT_FULL_COUNT', e.target.value || DEFAULT_SETTINGS.CLAUDE_MEM_CONTEXT_FULL_COUNT)}
                  />
                </FormField>
                <FormField
                  label="Field"
                  tooltip="Which field to expand for full observations"
                >
                  <select
                    value={formState.CLAUDE_MEM_CONTEXT_FULL_FIELD || 'narrative'}
                    onChange={(e) => updateSetting('CLAUDE_MEM_CONTEXT_FULL_FIELD', e.target.value)}
                  >
                    <option value="narrative">Narrative</option>
                    <option value="facts">Facts</option>
                  </select>
                </FormField>
              </div>

              <div className="display-subsection">
                <h4 className="subsection-label">Token economics</h4>
                <div className="toggle-group">
                  <ToggleSwitch
                    id="show-read-tokens"
                    label="Read cost"
                    description="Tokens to read this observation"
                    checked={formState.CLAUDE_MEM_CONTEXT_SHOW_READ_TOKENS === 'true'}
                    onChange={() => toggleBoolean('CLAUDE_MEM_CONTEXT_SHOW_READ_TOKENS')}
                  />
                  <ToggleSwitch
                    id="show-work-tokens"
                    label="Work investment"
                    description="Tokens spent creating this observation"
                    checked={formState.CLAUDE_MEM_CONTEXT_SHOW_WORK_TOKENS === 'true'}
                    onChange={() => toggleBoolean('CLAUDE_MEM_CONTEXT_SHOW_WORK_TOKENS')}
                  />
                  <ToggleSwitch
                    id="show-savings-amount"
                    label="Savings"
                    description="Total tokens saved by reusing context"
                    checked={formState.CLAUDE_MEM_CONTEXT_SHOW_SAVINGS_AMOUNT === 'true'}
                    onChange={() => toggleBoolean('CLAUDE_MEM_CONTEXT_SHOW_SAVINGS_AMOUNT')}
                  />
                </div>
              </div>
            </CollapsibleSection>

            {/* Section 4: Advanced */}
            <CollapsibleSection
              id="advanced"
              title="Advanced"
              description="AI provider and model selection"
              isOpen={openSections.advanced}
              onToggle={() => toggleSection('advanced')}
            >
              <FormField
                label="AI provider"
                tooltip="Choose the provider that generates observations: Claude (via Agent SDK), Gemini (via REST API), OpenRouter (also used by the claude-mem observer), Codex (your ChatGPT subscription), or any OpenAI-compatible endpoint"
              >
                <select
                  value={formState.CLAUDE_MEM_PROVIDER || 'claude'}
                  onChange={(e) => updateSetting('CLAUDE_MEM_PROVIDER', e.target.value)}
                >
                  <option value="claude">{claudeProviderOptionLabel(formState.CLAUDE_MEM_CLAUDE_AUTH_METHOD)}</option>
                  <option value="gemini">Gemini (uses API key)</option>
                  <option value="openrouter">OpenRouter / claude-mem observer</option>
                  <option value="codex">Codex (uses your ChatGPT subscription)</option>
                  <option value="openai-compatible">OpenAI-compatible endpoint (BYOK)</option>
                </select>
              </FormField>

              {formState.CLAUDE_MEM_PROVIDER === 'claude' && (
                <>
                  <FormField
                    label="Claude model"
                    tooltip="Claude model used for generating observations"
                  >
                    <select
                      value={formState.CLAUDE_MEM_MODEL || 'haiku'}
                      onChange={(e) => updateSetting('CLAUDE_MEM_MODEL', e.target.value)}
                    >
                      <option value="haiku">haiku (fastest)</option>
                      <option value="sonnet">sonnet (balanced)</option>
                      <option value="opus">opus (highest quality)</option>
                    </select>
                  </FormField>
                  <FormField
                    label="Claude auth method"
                    tooltip="Records which Claude credential this install uses: your Claude account login (subscription), an ANTHROPIC_API_KEY (api-key), a custom ANTHROPIC_BASE_URL endpoint (gateway), or Claude Code's own credentials (cli). The credential itself comes from ~/.claude-mem/.env: an ANTHROPIC_BASE_URL or ANTHROPIC_API_KEY there is used even when this says subscription. Shared with the Quota Fallback Claude option."
                  >
                    <select
                      value={formState.CLAUDE_MEM_CLAUDE_AUTH_METHOD || 'subscription'}
                      onChange={(e) => updateSetting('CLAUDE_MEM_CLAUDE_AUTH_METHOD', e.target.value)}
                    >
                      <option value="subscription">subscription (Claude account login)</option>
                      <option value="api-key">api-key (ANTHROPIC_API_KEY)</option>
                      <option value="gateway">gateway (custom endpoint + token)</option>
                      <option value="cli">cli (Claude Code credentials)</option>
                    </select>
                  </FormField>
                </>
              )}

              {formState.CLAUDE_MEM_PROVIDER === 'codex' && (
                <FormField
                  label="Codex model"
                  tooltip="Optional model available through your Codex subscription; leave empty for the Codex default. Run codex login before starting the worker."
                >
                  <input
                    type="text"
                    value={formState.CLAUDE_MEM_CODEX_MODEL || ''}
                    onChange={(e) => updateSetting('CLAUDE_MEM_CODEX_MODEL', e.target.value)}
                    placeholder="gpt-6-luna"
                  />
                </FormField>
              )}

              {formState.CLAUDE_MEM_PROVIDER === 'gemini' && (
                <>
                  <FormField
                    label="Gemini API key"
                    tooltip="Your Google AI Studio API key (or set GEMINI_API_KEY env var)"
                  >
                    <input
                      type="password"
                      value={formState.CLAUDE_MEM_GEMINI_API_KEY || ''}
                      onChange={(e) => updateSetting('CLAUDE_MEM_GEMINI_API_KEY', e.target.value)}
                      placeholder="AIza…"
                    />
                  </FormField>
                  <FormField
                    label="Gemini model"
                    tooltip="Gemini model used for generating observations"
                  >
                    <select
                      value={formState.CLAUDE_MEM_GEMINI_MODEL || 'gemini-flash-latest'}
                      onChange={(e) => updateSetting('CLAUDE_MEM_GEMINI_MODEL', e.target.value)}
                    >
                      <option value="gemini-flash-latest">gemini-flash-latest (default, latest GA Flash)</option>
                      <option value="gemini-flash-lite-latest">gemini-flash-lite-latest (latest GA Flash-Lite)</option>
                      <option value="gemini-3.5-flash">gemini-3.5-flash</option>
                      <option value="gemini-3.1-flash-lite">gemini-3.1-flash-lite</option>
                      <option value="gemini-3-flash-preview">gemini-3-flash-preview (preview)</option>
                    </select>
                  </FormField>
                  <div className="toggle-group" style={{ marginTop: '8px' }}>
                    <ToggleSwitch
                      id="gemini-rate-limiting"
                      label="Rate limiting"
                      description="Enable for free tier (10-30 RPM). Disable if you have billing set up (1000+ RPM)."
                      checked={formState.CLAUDE_MEM_GEMINI_RATE_LIMITING_ENABLED === 'true'}
                      onChange={(checked) => updateSetting('CLAUDE_MEM_GEMINI_RATE_LIMITING_ENABLED', checked ? 'true' : 'false')}
                    />
                  </div>
                </>
              )}

              {formState.CLAUDE_MEM_PROVIDER === 'openrouter' && (
                <>
                  <FormField
                    label="OpenRouter API key"
                    tooltip="Your OpenRouter API key from openrouter.ai (or set OPENROUTER_API_KEY env var)"
                  >
                    <input
                      type="password"
                      value={formState.CLAUDE_MEM_OPENROUTER_API_KEY || ''}
                      onChange={(e) => updateSetting('CLAUDE_MEM_OPENROUTER_API_KEY', e.target.value)}
                      placeholder="sk-or-v1-…"
                    />
                  </FormField>
                  <FormField
                    label="OpenRouter model"
                    tooltip="Model identifier from openrouter.ai/models (e.g., anthropic/claude-haiku-4.5, google/gemini-2.5-flash)"
                  >
                    <input
                      type="text"
                      value={formState.CLAUDE_MEM_OPENROUTER_MODEL || DEFAULT_SETTINGS.CLAUDE_MEM_OPENROUTER_MODEL}
                      onChange={(e) => updateSetting('CLAUDE_MEM_OPENROUTER_MODEL', e.target.value)}
                      placeholder={`e.g., ${DEFAULT_SETTINGS.CLAUDE_MEM_OPENROUTER_MODEL}`}
                    />
                  </FormField>
                  <FormField
                    label="OpenRouter base URL"
                    tooltip={observerManagesBaseUrl
                      ? 'Managed by the claude-mem observer. Run npx claude-mem install to use your own endpoint.'
                      : 'Optional OpenAI-compatible base URL. Leave blank to use openrouter.ai.'}
                  >
                    <input
                      type="text"
                      value={formState.CLAUDE_MEM_OPENROUTER_BASE_URL || ''}
                      onChange={(e) => updateSetting('CLAUDE_MEM_OPENROUTER_BASE_URL', e.target.value)}
                      placeholder="https://openrouter.ai/api/v1"
                      readOnly={observerManagesBaseUrl}
                    />
                  </FormField>
                  {!observerManagesBaseUrl && (
                    <FormField
                      label="Reasoning effort"
                      tooltip="openrouter.ai models only. None turns reasoning off, for models that spend the output budget thinking. Default sends nothing."
                    >
                      <select
                        value={formState.CLAUDE_MEM_OPENROUTER_REASONING_EFFORT || ''}
                        onChange={(e) => updateSetting('CLAUDE_MEM_OPENROUTER_REASONING_EFFORT', e.target.value)}
                      >
                        <option value="">Model default</option>
                        <option value="none">None (reasoning off)</option>
                        <option value="minimal">Minimal</option>
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                      </select>
                    </FormField>
                  )}
                  <FormField
                    label="Site URL (optional)"
                    tooltip="Your site URL for OpenRouter analytics (optional)"
                  >
                    <input
                      type="text"
                      value={formState.CLAUDE_MEM_OPENROUTER_SITE_URL || ''}
                      onChange={(e) => updateSetting('CLAUDE_MEM_OPENROUTER_SITE_URL', e.target.value)}
                      placeholder="https://example.com"
                    />
                  </FormField>
                  <FormField
                    label="App name (optional)"
                    tooltip="Your app name for OpenRouter analytics (optional)"
                  >
                    <input
                      type="text"
                      value={formState.CLAUDE_MEM_OPENROUTER_APP_NAME || 'claude-mem'}
                      onChange={(e) => updateSetting('CLAUDE_MEM_OPENROUTER_APP_NAME', e.target.value)}
                      placeholder="claude-mem"
                    />
                  </FormField>
                </>
              )}

              {formState.CLAUDE_MEM_PROVIDER === 'openai-compatible' && (
                <>
                  <FormField
                    label="Endpoint preset"
                    tooltip="Fills in the base URL and default model; the fields below override it"
                  >
                    <select
                      value={openAICompatPresetOption(formState.CLAUDE_MEM_OPENAI_COMPAT_PRESET).id}
                      onChange={(e) => updateSetting('CLAUDE_MEM_OPENAI_COMPAT_PRESET', e.target.value)}
                    >
                      {OPENAI_COMPAT_PRESET_OPTIONS.map(preset => (
                        <option key={preset.id} value={preset.id}>{preset.label}</option>
                      ))}
                    </select>
                  </FormField>
                  {openAICompatPresetOption(formState.CLAUDE_MEM_OPENAI_COMPAT_PRESET).note && (
                    <span className="toggle-description">
                      {openAICompatPresetOption(formState.CLAUDE_MEM_OPENAI_COMPAT_PRESET).note}
                    </span>
                  )}
                  <FormField
                    label="Base URL"
                    tooltip="Leave blank to use the preset's endpoint"
                  >
                    <input
                      type="text"
                      value={formState.CLAUDE_MEM_OPENAI_COMPAT_BASE_URL || ''}
                      onChange={(e) => updateSetting('CLAUDE_MEM_OPENAI_COMPAT_BASE_URL', e.target.value)}
                      placeholder={openAICompatPresetOption(formState.CLAUDE_MEM_OPENAI_COMPAT_PRESET).baseUrl || 'https://my-gateway.example.com/v1'}
                    />
                  </FormField>
                  <FormField
                    label="Model"
                    tooltip="Model id, passed verbatim. Leave blank to use the preset's default"
                  >
                    <input
                      type="text"
                      value={formState.CLAUDE_MEM_OPENAI_COMPAT_MODEL || ''}
                      onChange={(e) => updateSetting('CLAUDE_MEM_OPENAI_COMPAT_MODEL', e.target.value)}
                      placeholder={openAICompatPresetOption(formState.CLAUDE_MEM_OPENAI_COMPAT_PRESET).defaultModel || 'model id'}
                    />
                  </FormField>
                  <span className="toggle-description">
                    The API key is set outside the viewer: <code>CLAUDE_MEM_OPENAI_COMPAT_API_KEY</code> in{' '}
                    <code>~/.claude-mem/settings.json</code>, or <code>OPENAI_COMPAT_API_KEY</code> in{' '}
                    <code>~/.claude-mem/.env</code>. Local servers need none.
                  </span>
                </>
              )}

              <FormField
                label="Quota fallback"
                tooltip="While the selected provider cannot serve (allowance spent, rate limited or over capacity past its retries, unavailable, or repeatedly returning unusable replies), send observation work here until it recovers. Claude (your Anthropic plan) is the default and is used only when a Claude login or key exists. Off: work waits for the provider."
              >
                <select
                  value={formState.CLAUDE_MEM_QUOTA_FALLBACK_PROVIDER || 'claude'}
                  onChange={(e) => updateSetting('CLAUDE_MEM_QUOTA_FALLBACK_PROVIDER', e.target.value)}
                >
                  <option value="claude">{claudeProviderOptionLabel(formState.CLAUDE_MEM_CLAUDE_AUTH_METHOD)}</option>
                  <option value="off">Off (wait for the provider)</option>
                  <option value="gemini">Gemini (uses API key)</option>
                  <option value="openrouter">OpenRouter / claude-mem observer</option>
                  <option value="openai-compatible">OpenAI-compatible endpoint</option>
                </select>
              </FormField>

              {(formState.CLAUDE_MEM_QUOTA_FALLBACK_PROVIDER || 'claude') === 'claude' && (
                <>
                  <FormField
                    label="Claude auth method"
                    tooltip="The same CLAUDE_MEM_CLAUDE_AUTH_METHOD setting as the AI provider's Claude auth method. Fallback Claude runs use the same credential, which comes from ~/.claude-mem/.env when an ANTHROPIC_BASE_URL or ANTHROPIC_API_KEY is set there."
                  >
                    <select
                      value={formState.CLAUDE_MEM_CLAUDE_AUTH_METHOD || 'subscription'}
                      onChange={(e) => updateSetting('CLAUDE_MEM_CLAUDE_AUTH_METHOD', e.target.value)}
                    >
                      <option value="subscription">subscription (Claude account login)</option>
                      <option value="api-key">api-key (ANTHROPIC_API_KEY)</option>
                      <option value="gateway">gateway (custom endpoint + token)</option>
                      <option value="cli">cli (Claude Code credentials)</option>
                    </select>
                  </FormField>
                  <FormField
                    label="Fallback Claude model"
                    tooltip="Claude model for fallback runs only. Blank uses the Claude Model setting and tier routing."
                  >
                    <input
                      type="text"
                      value={formState.CLAUDE_MEM_QUOTA_FALLBACK_MODEL || ''}
                      onChange={(e) => updateSetting('CLAUDE_MEM_QUOTA_FALLBACK_MODEL', e.target.value)}
                      placeholder="e.g., claude-haiku-4-5-20251001"
                    />
                  </FormField>
                </>
              )}

              <FormField
                label="Claude Credential Fallback"
                tooltip="For a Claude observer: the other credential to run on while the primary one is held for quota, tried before the Quota Fallback provider. Subscription: a spent ANTHROPIC_API_KEY (e.g. credit balance too low) hands over to your Claude Code login, still protected by the quota guard. API key: a login that is spent or paused by the quota guard hands over to ANTHROPIC_FALLBACK_API_KEY in ~/.claude-mem/.env, billed per request. Either returns to the primary once it recovers; neither applies under ANTHROPIC_BASE_URL."
              >
                <select
                  value={formState.CLAUDE_MEM_QUOTA_FALLBACK_AUTH_METHOD || ''}
                  onChange={(e) => updateSetting('CLAUDE_MEM_QUOTA_FALLBACK_AUTH_METHOD', e.target.value)}
                >
                  <option value="">Off (wait for the primary credential)</option>
                  <option value="subscription">Subscription (Claude Code login)</option>
                  <option value="api-key">API key (ANTHROPIC_FALLBACK_API_KEY)</option>
                </select>
              </FormField>

              <FormField
                label="Claude Code CLI path"
                tooltip="Executable path for the Claude Code CLI. File/env only — edit ~/.claude-mem/settings.json or set CLAUDE_CODE_PATH in the environment, then restart the worker."
              >
                <input
                  type="text"
                  value={formState.CLAUDE_CODE_PATH || ''}
                  readOnly
                  disabled
                  placeholder="Auto-detected"
                />
                <span className="toggle-description">
                  Read-only here. Set <code>CLAUDE_CODE_PATH</code> in <code>~/.claude-mem/settings.json</code> or the environment.
                </span>
              </FormField>

              <FormField
                label="Worker port"
                  error={errors.CLAUDE_MEM_WORKER_PORT}
                tooltip="Port for the background worker service"
              >
                <input
                  type="number"
                  min="1024"
                  max="65535"
                  value={formState.CLAUDE_MEM_WORKER_PORT || DEFAULT_SETTINGS.CLAUDE_MEM_WORKER_PORT}
                  {...numberField('CLAUDE_MEM_WORKER_PORT')}
                  onChange={(e) => updateSetting('CLAUDE_MEM_WORKER_PORT', e.target.value)}
                />
              </FormField>

              <div className="toggle-group" style={{ marginTop: '12px' }}>
                <ToggleSwitch
                  id="show-last-summary"
                  label="Include last summary"
                  description="Add previous session's summary to context"
                  checked={formState.CLAUDE_MEM_CONTEXT_SHOW_LAST_SUMMARY === 'true'}
                  onChange={() => toggleBoolean('CLAUDE_MEM_CONTEXT_SHOW_LAST_SUMMARY')}
                />
                <ToggleSwitch
                  id="show-last-message"
                  label="Include last message"
                  description="Add previous session's final message"
                  checked={formState.CLAUDE_MEM_CONTEXT_SHOW_LAST_MESSAGE === 'true'}
                  onChange={() => toggleBoolean('CLAUDE_MEM_CONTEXT_SHOW_LAST_MESSAGE')}
                />
                <ToggleSwitch
                  id="file-read-gate"
                  label="Block full-file reads"
                  description="Send Claude to smart_outline/smart_unfold and past observations instead of reading whole code files of 32 KB and up that have history"
                  checked={formState.CLAUDE_MEM_FILE_READ_GATE_ENABLED !== 'false'}
                  onChange={(checked) => updateSetting('CLAUDE_MEM_FILE_READ_GATE_ENABLED', checked ? 'true' : 'false')}
                />
              </div>
            </CollapsibleSection>
          </fieldset>

            <div className="modal-footer settings-footer">
              <div className="save-status">
                {loadError ? (
                  <ErrorNotice
                    className="error-notice--inline"
                    message="Your saved settings could not be loaded, so Save is paused to keep them safe."
                    detail={loadError}
                    onRetry={onRetryLoad}
                  />
                ) : !isLoaded ? (
                  <span>{blockedNotice ? `Loading settings… ${blockedNotice}` : 'Loading settings…'}</span>
                ) : (
                  saveStatus && <span className={saveStatusClass(saveStatus)} role="status">{saveStatus}</span>
                )}
              </div>
              <button
                type="button"
                className="btn btn-primary save-btn"
                onClick={handleSave}
                aria-disabled={isSaving || !isLoaded}
              >
                {isSaving ? 'Saving...' : 'Save changes'}
              </button>
            </div>
          </div>

          <aside className="preview-column" aria-label="Context preview">
            <div className="preview-controls">
              <label className="preview-selector">
                <span>Source</span>
                <select
                  value={selectedSource || ''}
                  onChange={(e) => setSelectedSource(e.target.value)}
                  disabled={sources.length === 0}
                >
                  <option value="">All sources</option>
                  {sources.map(source => (
                    <option key={source} value={source}>{source}</option>
                  ))}
                </select>
              </label>
              <label className="preview-selector">
                <span>Project</span>
                <select
                  value={selectedProject || ''}
                  onChange={(e) => setSelectedProject(e.target.value)}
                  disabled={projects.length === 0}
                >
                  {projects.map(project => (
                    <option key={project} value={project}>{project}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="preview-content">
              {error ? (
                <ErrorNotice
                  message="The preview could not be built. Your settings still save normally."
                  detail={error}
                />
              ) : (
                <TerminalPreview content={preview} isLoading={isLoading} />
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
