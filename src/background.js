/**
 * src/background.js — Chrome Extension Service Worker (MV3)
 *
 * Responsibilities:
 *   1. Act as AI proxy: receive AUTOFILL_AI_REQUEST from content scripts,
 *      call the AI provider (OpenAI / Gemini), return the draft response.
 *   2. Coordinate chrome.storage (future: cache management).
 *
 * Exported for testing:
 *   - validateAISettings(settings) → {valid, error}
 *   - makeAIMessageHandler(fetch)  → chrome.runtime.onMessage handler
 *
 * Why a proxy? Content scripts cannot call AI APIs cross-origin in MV3 without
 * the host permission, and we don't want to bundle the key into the content
 * script. The service worker handles the fetch.
 */

// ─── Supported providers ──────────────────────────────────────────────────────

const SUPPORTED_PROVIDERS = new Set(['openai', 'gemini']);

const PROVIDER_ENDPOINTS = {
  openai: 'https://api.openai.com/v1/chat/completions',
  gemini: (model = 'gemini-2.0-flash') =>
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
};

const DEFAULT_MODELS = {
  openai: 'gpt-4o-mini',
  gemini: 'gemini-2.0-flash',
};

// ─── Settings validation ──────────────────────────────────────────────────────

/**
 * Validate AI provider settings.
 *
 * @param {object|null|undefined} settings
 * @returns {{valid: boolean, error?: string}}
 */
export function validateAISettings(settings) {
  if (!settings) return { valid: false, error: 'No AI settings provided.' };

  const { aiProvider, aiApiKey } = settings;

  if (!aiProvider) return { valid: false, error: 'AI provider is required.' };
  if (!SUPPORTED_PROVIDERS.has(aiProvider)) {
    return { valid: false, error: `Unknown AI provider: "${aiProvider}". Supported: openai, gemini.` };
  }
  if (!aiApiKey || String(aiApiKey).trim() === '') {
    return { valid: false, error: 'AI API key is required.' };
  }

  return { valid: true };
}

// ─── AI call helpers ──────────────────────────────────────────────────────────

/**
 * Build the prompt for the AI model given a question label and profile context.
 *
 * @param {string} question
 * @param {object} profile
 * @returns {string}
 */
function buildPrompt(question, profile) {
  const name = [profile.firstName, profile.lastName].filter(Boolean).join(' ');
  const role = profile.workHistory?.[0]?.title || 'software professional';
  const skills = (profile.skills || []).slice(0, 5).join(', ');

  return (
    `You are helping ${name || 'a job applicant'} fill in a job application form.\n` +
    `Their most recent role: ${role}.\n` +
    `Key skills: ${skills || 'not specified'}.\n\n` +
    `Please write a concise, professional answer (2–4 sentences) to this application question:\n` +
    `"${question}"\n\n` +
    `Answer in first person. Do not include the question in your response.`
  );
}

/**
 * Call OpenAI Chat Completions API.
 *
 * @param {string}   prompt
 * @param {object}   settings
 * @param {Function} fetchFn
 * @returns {Promise<string>}
 */
async function callOpenAI(prompt, settings, fetchFn) {
  const model = settings.aiModel || DEFAULT_MODELS.openai;
  const response = await fetchFn(PROVIDER_ENDPOINTS.openai, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${settings.aiApiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 256,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI API error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() ?? '';
}

/**
 * Call Google Gemini generateContent API.
 *
 * @param {string}   prompt
 * @param {object}   settings
 * @param {Function} fetchFn
 * @returns {Promise<string>}
 */
async function callGemini(prompt, settings, fetchFn) {
  const model = settings.aiModel || DEFAULT_MODELS.gemini;
  const url = `${PROVIDER_ENDPOINTS.gemini(model)}?key=${settings.aiApiKey}`;
  const response = await fetchFn(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
}

// ─── Message handler ──────────────────────────────────────────────────────────

const MSG_AI_REQUEST = 'AUTOFILL_AI_REQUEST';

/**
 * Create the chrome.runtime.onMessage handler for AI requests.
 * Accepts a `fetchFn` so tests can inject a mock.
 *
 * @param {Function} fetchFn  — the fetch implementation to use (default: globalThis.fetch)
 * @returns {Function}        — handler(message, sender, sendResponse) → boolean|undefined
 */
export function makeAIMessageHandler(fetchFn = globalThis.fetch) {
  return function onMessage(message, _sender, sendResponse) {
    if (!message || message.type !== MSG_AI_REQUEST) {
      return; // not handled
    }

    const { question, label, profile, settings } = message;

    // Run async, keep channel open by returning true
    (async () => {
      try {
        // Validate settings
        const validation = validateAISettings(settings);
        if (!validation.valid) {
          sendResponse({ error: validation.error });
          return;
        }

        const prompt = buildPrompt(label || question, profile || {});

        let draft;
        if (settings.aiProvider === 'openai') {
          draft = await callOpenAI(prompt, settings, fetchFn);
        } else if (settings.aiProvider === 'gemini') {
          draft = await callGemini(prompt, settings, fetchFn);
        } else {
          sendResponse({ error: `Unsupported provider: ${settings.aiProvider}` });
          return;
        }

        sendResponse({ draft });
      } catch (err) {
        sendResponse({ error: err.message || String(err) });
      }
    })();

    return true; // async response
  };
}

// ─── Extension entry point ────────────────────────────────────────────────────

// Register the handler when running as a real Chrome extension
if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener(makeAIMessageHandler(fetch));
}
