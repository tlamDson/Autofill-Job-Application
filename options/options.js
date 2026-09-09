/**
 * options.js — Entry point cho Options page.
 * Loads profile from store, renders all sections, auto-saves on change.
 */

import { loadProfile, saveProfile } from '../src/profile/store.js';
import { normalizeProfile } from '../src/profile/schema.js';
import { renderPersonal } from './sections/personal.js';
import { renderLinks } from './sections/links.js';
import { renderEducation } from './sections/education.js';
import { renderWorkHistory } from './sections/workHistory.js';

const app = document.getElementById('app');

async function init() {
  const profile = await loadProfile();

  // Clear placeholder text
  app.innerHTML = '<h1>Profile Settings</h1>';

  async function onSave(updated) {
    const normalized = normalizeProfile(updated);
    await saveProfile(normalized);
  }

  renderPersonal(app, profile, onSave);
  renderLinks(app, profile, onSave);
  renderEducation(app, profile, onSave);
  renderWorkHistory(app, profile, onSave);
  // P0.6: workAuth, eeo, compensation, skills
  // P0.7: resume files
  // P0.8: import/export
}

init().catch(console.error);
