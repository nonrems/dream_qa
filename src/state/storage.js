const STORAGE_KEYS = {
  settings: "dream_qa.settings",
  session: "dream_qa.session",
  history: "dream_qa.history",
};

function readJson(key, fallbackValue) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallbackValue;
  } catch {
    return fallbackValue;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function loadSettings() {
  return readJson(STORAGE_KEYS.settings, { role: null });
}

export function saveSettings(settings) {
  writeJson(STORAGE_KEYS.settings, settings);
}

export function loadSession() {
  return readJson(STORAGE_KEYS.session, null);
}

export function saveSession(session) {
  writeJson(STORAGE_KEYS.session, session);
}

export function clearSession() {
  localStorage.removeItem(STORAGE_KEYS.session);
}

export function loadHistory() {
  return readJson(STORAGE_KEYS.history, { sessions: [] });
}

export function saveHistory(history) {
  writeJson(STORAGE_KEYS.history, history);
}
