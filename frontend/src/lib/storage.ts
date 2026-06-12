import { Settings, HistorySession } from '../types';

const SETTINGS_KEY = 'prism_settings';
const HISTORY_KEY = 'prism_local_history';

export const DEFAULT_SETTINGS: Settings = {
  localUrl: 'http://localhost:8080/v1',
  groqKey: '',
  geminiKey: '',
  groqModel: 'llama-3.3-70b-versatile',
  geminiModel: 'gemini-2.0-flash',
  maxTokensLocal: 2048,
  maxTokensGroq: 1024,
  maxTokensGemini: 1024,
  costLimit: 5.0,
  decompTemp: 0.1,
  showPreview: true,
  autoExport: false,
};

export const loadSettings = (): Settings => {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    }
  } catch (e) {
    console.error('Failed to load settings', e);
  }
  return DEFAULT_SETTINGS;
};

export const saveSettings = (settings: Settings) => {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to save settings', e);
  }
};

export const loadLocalHistory = (): HistorySession[] => {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Failed to load local history', e);
  }
  return [];
};

export const saveLocalHistory = (history: HistorySession[]) => {
  try {
    // Pinned to last 20 sessions
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 20)));
  } catch (e) {
    console.error('Failed to save local history', e);
  }
};
export const clearLocalHistory = () => {
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch (e) {
    console.error('Failed to clear local history', e);
  }
};
