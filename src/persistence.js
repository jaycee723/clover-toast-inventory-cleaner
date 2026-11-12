/**
 * Persistent Memory Module for Clover to Toast Retail Import Studio
 * Handles local browser persistence (localStorage) and cloud session synchronization.
 */

const LOCAL_STORAGE_KEY = 'clover_toast_persistent_memory_v1';
const LOCAL_SETTINGS_KEY = 'clover_toast_app_settings_v1';

/**
 * Saves the active working session into browser local storage for instant recovery.
 * @param {Object} state
 * @returns {boolean}
 */
export function saveLocalWorkingState(state) {
  if (typeof window === 'undefined' || !window.localStorage) return false;
  try {
    if (!state || (!state.records?.length && !state.loadedFileName)) {
      return false;
    }

    const payload = {
      version: 1,
      savedAt: new Date().toISOString(),
      loadedFileName: state.loadedFileName || '',
      fileStatusSub: state.fileStatusSub || '',
      currentStep: state.currentStep || 1,
      scorecard: state.scorecard || null,
      records: state.records || [],
      canonical: state.canonical || [],
      decisions: state.decisions || {},
      itemCount: state.records?.length || 0
    };

    const serialized = JSON.stringify(payload);
    // Guard against quota limits (typically 5MB-10MB)
    if (serialized.length > 4500000) {
      console.warn('Persistent memory size exceeded localStorage limit; trimming canonical data');
      payload.canonical = [];
      window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(payload));
    } else {
      window.localStorage.setItem(LOCAL_STORAGE_KEY, serialized);
    }
    return true;
  } catch (err) {
    console.warn('Failed to save working state to local persistent memory:', err);
    return false;
  }
}

/**
 * Loads the active working session from browser local storage if available.
 * @returns {Object|null}
 */
export function loadLocalWorkingState() {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.records || !Array.isArray(parsed.records)) {
      return null;
    }
    return parsed;
  } catch (err) {
    console.warn('Failed to parse local persistent memory:', err);
    return null;
  }
}

/**
 * Clears the active working state from local storage.
 */
export function clearLocalWorkingState() {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.removeItem(LOCAL_STORAGE_KEY);
  } catch (err) {
    console.warn('Failed to clear local persistent memory:', err);
  }
}

/**
 * Saves user preferences (e.g. autoSyncCloud, storeName).
 * @param {Object} settings
 */
export function saveAppSettings(settings) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(LOCAL_SETTINGS_KEY, JSON.stringify(settings || {}));
  } catch (err) {
    console.warn('Failed to save app settings:', err);
  }
}

/**
 * Loads user preferences.
 * @returns {Object}
 */
export function loadAppSettings() {
  if (typeof window === 'undefined' || !window.localStorage) return {};
  try {
    const raw = window.localStorage.getItem(LOCAL_SETTINGS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (err) {
    return {};
  }
}
