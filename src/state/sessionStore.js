import { TIMELINE_DEFINITION } from "../data/timeline.js";
import { generateChoiceOrders, generateSessionPattern } from "../logic/generateSession.js";
import {
  clearSession,
  loadHistory,
  loadSession,
  loadSettings,
  saveHistory,
  saveSession,
  saveSettings,
} from "./storage.js";

function getFirstPlayableEventId() {
  return TIMELINE_DEFINITION.find((event) => event.kind !== "role_select")?.id ?? null;
}

function createEmptyProgress() {
  return {
    currentEventId: getFirstPlayableEventId(),
    eventStartedAt: Date.now(),
    timerStopped: false,
    eventPausedAt: null,
    eventTotalPausedMs: 0,
  };
}

export function createNewSession(role, mode = "practice") {
  const pattern = generateSessionPattern(role);
  const choiceOrders = generateChoiceOrders(role);

  return {
    sessionId: crypto.randomUUID(),
    startedAt: Date.now(),
    role,
    mode,
    pattern,
    choiceOrders,
    progress: createEmptyProgress(),
    answers: {},
    results: {},
    memoLog: [],
    appliedMemoEventIds: [],
  };
}

export function initializeStore() {
  const settings = loadSettings();
  const session = loadSession();
  const history = loadHistory();

  return {
    settings,
    history,
    session,
    screen: session ? "timeline" : settings.role ? "home" : "role-select",
  };
}

export function persistRole(role) {
  const nextSettings = { role };
  saveSettings(nextSettings);
  return nextSettings;
}

export function startSession(role, mode = "practice") {
  const session = createNewSession(role, mode);
  saveSession(session);
  return session;
}

export function updateSession(session) {
  saveSession(session);
}

export function abandonSession() {
  clearSession();
}

export function updateHistory(history) {
  saveHistory(history);
}
