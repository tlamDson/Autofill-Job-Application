/**
 * options.js — Entry point cho Options page.
 * Loads profile + settings, renders both tabs, auto-saves on change.
 * Tab shown is driven by location.hash (#profile / #settings), so it
 * survives a reload and can be deep-linked (e.g. from the popup gear icon).
 */

import { loadProfile, saveProfile } from '../src/profile/store.js';
import { normalizeProfile } from '../src/profile/schema.js';
import { loadSettings, saveSettings } from '../src/settings/store.js';
import { renderPersonal } from './sections/personal.js';
import { renderLinks } from './sections/links.js';
import { renderEducation } from './sections/education.js';
import { renderWorkHistory } from './sections/workHistory.js';
import { renderWorkAuth } from './sections/workAuth.js';
import { renderEEO } from './sections/eeo.js';
import { renderCompensation } from './sections/compensation.js';
import { renderSkills } from './sections/skills.js';
import { renderSettings } from './sections/settings.js';

const tabBar = document.getElementById('tab-bar');
const panelProfile = document.getElementById('panel-profile');
const panelSettings = document.getElementById('panel-settings');

function currentTabFromHash() {
  const hash = (location.hash || '').replace('#', '');
  return hash === 'settings' ? 'settings' : 'profile';
}

function setActiveTab(tab) {
  panelProfile.hidden = tab !== 'profile';
  panelSettings.hidden = tab !== 'settings';
  for (const btn of tabBar.querySelectorAll('.tab-btn')) {
    const isActive = btn.dataset.tab === tab;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-selected', String(isActive));
  }
}

tabBar.addEventListener('click', (event) => {
  const btn = event.target.closest('.tab-btn');
  if (!btn) return;
  location.hash = btn.dataset.tab;
});

window.addEventListener('hashchange', () => setActiveTab(currentTabFromHash()));

async function init() {
  const profile = await loadProfile();
  const settings = await loadSettings();

  async function onSaveProfile(updated) {
    const normalized = normalizeProfile(updated);
    await saveProfile(normalized);
  }

  async function onSaveSettings(updated) {
    await saveSettings(updated);
  }

  renderPersonal(panelProfile, profile, onSaveProfile);
  renderLinks(panelProfile, profile, onSaveProfile);
  renderEducation(panelProfile, profile, onSaveProfile);
  renderWorkHistory(panelProfile, profile, onSaveProfile);
  renderWorkAuth(panelProfile, profile, onSaveProfile);
  renderEEO(panelProfile, profile, onSaveProfile);
  renderCompensation(panelProfile, profile, onSaveProfile);
  renderSkills(panelProfile, profile, onSaveProfile);

  renderSettings(panelSettings, settings, onSaveSettings);

  setActiveTab(currentTabFromHash());
}

init().catch(console.error);
