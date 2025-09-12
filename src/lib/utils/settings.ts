import { UiSettings } from '@/lib/types';

export const KEY = 'super-plan.settings.v1';

export function defaultSettings(): UiSettings {
  return {
    showCurrentBar: true,
    showBottomSummary: true,
    showProgress: false,
    showConflictCount: true,
    showTotalExpected: false,
    showCompressionRatio: false,
    lockEndTime: false,
    autoSaveToDb: false,
  };
}

export function loadSettings(): UiSettings {
  if (typeof window === 'undefined') return defaultSettings();
  const raw = localStorage.getItem(KEY);
  if (!raw) return defaultSettings();
  try {
    const parsed = JSON.parse(raw) as Partial<UiSettings>;
    return { ...defaultSettings(), ...parsed };
  } catch {
    return defaultSettings();
  }
}

export function saveSettings(s: UiSettings) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY, JSON.stringify(s));
  try {
    // 同步广播给同页其他路由/组件
    if ('BroadcastChannel' in window) {
      const bc = new BroadcastChannel('super-plan');
      bc.postMessage({ type: 'settings:update', payload: s });
      bc.close();
    }
  } catch {}
}
