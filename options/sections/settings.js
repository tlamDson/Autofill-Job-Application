/**
 * settings.js — Options UI section for app-level Settings tab.
 * Vanilla JS, no framework. Auto-saves on every change via onSave.
 *
 * @param {HTMLElement} container - Root element to render into
 * @param {object} settings - Current settings data (shape: src/settings/store.js DEFAULT_SETTINGS)
 * @param {(updatedSettings: object) => void} [onSave] - Called with updated settings on change
 */

import { validateAISettings, SUPPORTED_PROVIDERS, DEFAULT_MODELS } from '../../src/background.js';
import {
  FIELD_GROUPS,
  isFieldEnabled,
  setFieldEnabled,
  setGroupEnabled,
  groupState,
} from '../../src/settings/fieldGroups.js';

const KEY_LABEL_OVERRIDES = {
  gpa: 'GPA',
};

/** camelCase key -> "Title Case" label, with overrides for acronyms. */
function labelFor(key) {
  if (KEY_LABEL_OVERRIDES[key]) return KEY_LABEL_OVERRIDES[key];
  const spaced = key.replace(/([a-z])([A-Z])/g, '$1 $2');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function fieldWrapper() {
  const wrapper = document.createElement('div');
  wrapper.className = 'field-wrapper';
  return wrapper;
}

function makeToggle({ checked, dataAttr, dataValue, onChange }) {
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.setAttribute('role', 'switch');
  input.setAttribute(dataAttr, dataValue);
  input.checked = checked;
  input.addEventListener('change', () => onChange(input.checked));
  return input;
}

/** deep-clone helper — settings is JSON-serializable */
function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// ─── AI provider block ──────────────────────────────────────────────────────

function renderAIBlock(section, settings, emit) {
  const h3 = document.createElement('h3');
  h3.textContent = 'AI Provider';
  section.appendChild(h3);

  const ai = settings.ai || { provider: '', apiKey: '', model: '' };

  // Provider select
  const providerWrapper = fieldWrapper();
  const providerLabel = document.createElement('label');
  providerLabel.textContent = 'Provider';
  const providerSelect = document.createElement('select');
  providerSelect.setAttribute('data-field', 'ai.provider');
  const blankOpt = document.createElement('option');
  blankOpt.value = '';
  blankOpt.textContent = '-- Select provider --';
  providerSelect.appendChild(blankOpt);
  for (const provider of SUPPORTED_PROVIDERS) {
    const opt = document.createElement('option');
    opt.value = provider;
    opt.textContent = provider;
    providerSelect.appendChild(opt);
  }
  providerSelect.value = ai.provider || '';
  providerLabel.appendChild(providerSelect);
  providerWrapper.appendChild(providerLabel);
  section.appendChild(providerWrapper);

  // API key input with show/hide toggle
  const apiKeyWrapper = fieldWrapper();
  const apiKeyLabel = document.createElement('label');
  apiKeyLabel.textContent = 'API Key';
  const apiKeyInput = document.createElement('input');
  apiKeyInput.type = 'password';
  apiKeyInput.setAttribute('data-field', 'ai.apiKey');
  apiKeyInput.value = ai.apiKey || '';
  apiKeyLabel.appendChild(apiKeyInput);
  const toggleBtn = document.createElement('button');
  toggleBtn.type = 'button';
  toggleBtn.textContent = 'Show';
  toggleBtn.setAttribute('data-action', 'toggle-apikey-visibility');
  toggleBtn.addEventListener('click', () => {
    const isHidden = apiKeyInput.type === 'password';
    apiKeyInput.type = isHidden ? 'text' : 'password';
    toggleBtn.textContent = isHidden ? 'Hide' : 'Show';
  });
  apiKeyWrapper.appendChild(apiKeyLabel);
  apiKeyWrapper.appendChild(toggleBtn);
  section.appendChild(apiKeyWrapper);

  // Model input
  const modelWrapper = fieldWrapper();
  const modelLabel = document.createElement('label');
  modelLabel.textContent = 'Model';
  const modelInput = document.createElement('input');
  modelInput.type = 'text';
  modelInput.setAttribute('data-field', 'ai.model');
  modelInput.value = ai.model || '';
  modelInput.placeholder = DEFAULT_MODELS[ai.provider] || 'e.g. gpt-4o-mini';
  modelLabel.appendChild(modelInput);
  modelWrapper.appendChild(modelLabel);
  section.appendChild(modelWrapper);

  const error = document.createElement('span');
  error.setAttribute('data-error', 'ai');
  error.className = 'field-error';
  error.style.color = 'red';
  error.style.display = 'none';
  section.appendChild(error);

  function commit() {
    const updated = clone(settings);
    updated.ai = {
      provider: providerSelect.value,
      apiKey: apiKeyInput.value,
      model: modelInput.value,
    };

    const validation = validateAISettings({
      aiProvider: updated.ai.provider,
      aiApiKey: updated.ai.apiKey,
    });
    if (!validation.valid && (updated.ai.provider || updated.ai.apiKey)) {
      error.textContent = validation.error;
      error.style.display = '';
    } else {
      error.textContent = '';
      error.style.display = 'none';
    }

    modelInput.placeholder = DEFAULT_MODELS[updated.ai.provider] || 'e.g. gpt-4o-mini';
    emit(updated);
  }

  providerSelect.addEventListener('change', commit);
  apiKeyInput.addEventListener('change', commit);
  modelInput.addEventListener('change', commit);
}

// ─── Autofill behavior block ────────────────────────────────────────────────

function renderBehaviorBlock(section, settings, emit) {
  const h3 = document.createElement('h3');
  h3.textContent = 'Autofill Behavior';
  section.appendChild(h3);

  const rows = [
    {
      field: 'autoAnswerOpenQuestions',
      label: 'Answer unique questions with AI during autofill',
    },
    {
      field: 'showGenerateAIButton',
      label: 'Show "Generate with AI" button on form fields',
    },
    {
      field: 'continuousMultipage',
      label: 'Continuously autofill multipage forms',
    },
  ];

  for (const row of rows) {
    const wrapper = fieldWrapper();
    wrapper.className = 'field-wrapper setting-row';
    const label = document.createElement('label');
    label.textContent = row.label;
    const toggle = makeToggle({
      checked: !!settings[row.field],
      dataAttr: 'data-field',
      dataValue: row.field,
      onChange: (checked) => {
        const updated = clone(settings);
        updated[row.field] = checked;
        emit(updated);
      },
    });
    label.prepend(toggle);
    wrapper.appendChild(label);
    section.appendChild(wrapper);
  }

  // Resume filename select
  const resumeWrapper = fieldWrapper();
  resumeWrapper.className = 'field-wrapper setting-row';
  const resumeLabel = document.createElement('label');
  resumeLabel.textContent = 'Resume filename';
  const resumeSelect = document.createElement('select');
  resumeSelect.setAttribute('data-field', 'resumeFileName');
  const optUseMyName = document.createElement('option');
  optUseMyName.value = 'useMyName';
  optUseMyName.textContent = 'Use my name';
  const optOriginal = document.createElement('option');
  optOriginal.value = 'original';
  optOriginal.textContent = 'Original filename';
  resumeSelect.appendChild(optUseMyName);
  resumeSelect.appendChild(optOriginal);
  resumeSelect.value = settings.resumeFileName || 'useMyName';
  resumeSelect.addEventListener('change', () => {
    const updated = clone(settings);
    updated.resumeFileName = resumeSelect.value;
    emit(updated);
  });
  resumeLabel.appendChild(resumeSelect);
  resumeWrapper.appendChild(resumeLabel);
  section.appendChild(resumeWrapper);
}

// ─── Field toggles block ────────────────────────────────────────────────────

function renderFieldGroup(container, group, settings, emit) {
  const groupEl = document.createElement('div');
  groupEl.className = 'field-group';

  const header = document.createElement('div');
  header.className = 'field-group-header';

  const masterLabel = document.createElement('label');
  const masterToggle = document.createElement('input');
  masterToggle.type = 'checkbox';
  masterToggle.setAttribute('role', 'switch');
  masterToggle.setAttribute('data-group-toggle', group.id);
  const state = groupState(settings, group.id);
  masterToggle.checked = state === 'on';
  masterToggle.indeterminate = state === 'mixed';
  masterToggle.addEventListener('change', () => {
    const updated = setGroupEnabled(clone(settings), group.id, masterToggle.checked);
    emit(updated);
  });
  masterLabel.appendChild(masterToggle);
  const groupTitle = document.createElement('strong');
  groupTitle.textContent = group.label;
  masterLabel.appendChild(groupTitle);
  header.appendChild(masterLabel);
  groupEl.appendChild(header);

  const list = document.createElement('div');
  list.className = 'field-group-list';
  for (const key of group.keys) {
    const wrapper = fieldWrapper();
    wrapper.className = 'field-wrapper field-toggle-row';
    const label = document.createElement('label');
    label.textContent = labelFor(key);
    const toggle = makeToggle({
      checked: isFieldEnabled(settings, key),
      dataAttr: 'data-field-toggle',
      dataValue: key,
      onChange: (checked) => {
        const updated = setFieldEnabled(clone(settings), key, checked);
        emit(updated);
      },
    });
    label.prepend(toggle);
    wrapper.appendChild(label);
    list.appendChild(wrapper);
  }
  groupEl.appendChild(list);

  container.appendChild(groupEl);
}

function renderFieldsBlock(section, settings, emit, rerender) {
  const h3 = document.createElement('h3');
  h3.textContent = 'Fields to autofill';
  section.appendChild(h3);

  const groupsContainer = document.createElement('div');
  groupsContainer.setAttribute('data-fields-container', '');
  for (const group of FIELD_GROUPS) {
    renderFieldGroup(groupsContainer, group, settings, (updated) => {
      emit(updated);
      rerender(updated);
    });
  }
  section.appendChild(groupsContainer);
}

// ─── Entry point ────────────────────────────────────────────────────────────

export function renderSettings(container, settings, onSave) {
  const section = document.createElement('section');
  section.className = 'options-section settings-section';
  section.setAttribute('data-section', 'settings');

  const h2 = document.createElement('h2');
  h2.textContent = 'Settings';
  section.appendChild(h2);

  function emit(updated) {
    Object.assign(settings, updated);
    if (onSave) onSave(updated);
  }

  renderAIBlock(section, settings, emit);
  renderBehaviorBlock(section, settings, emit);

  const fieldsBlock = document.createElement('div');
  fieldsBlock.setAttribute('data-block', 'fields');
  section.appendChild(fieldsBlock);

  function rerenderFields(updatedSettings) {
    fieldsBlock.innerHTML = '';
    renderFieldsBlock(fieldsBlock, updatedSettings, emit, rerenderFields);
  }
  rerenderFields(settings);

  container.appendChild(section);
}
