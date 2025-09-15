'use client';

import { useEffect, useMemo, useState } from 'react';
import { UiSettings } from '@/lib/types';
import { defaultSettings, saveSettings } from '@/lib/utils/settings';
import { fetchUiSettings, saveUiSettings } from '@/lib/client/api';

export default function SettingsPage() {
  const [saved, setSaved] = useState<UiSettings>(defaultSettings());
  const [local, setLocal] = useState<UiSettings>(defaultSettings());

  useEffect(() => {
    (async () => {
      try {
        const s = await fetchUiSettings();
        const merged = { ...defaultSettings(), ...s };
        setSaved(merged);
        setLocal(merged);
      } catch {
        const s = defaultSettings();
        setSaved(s);
        setLocal(s);
      }
    })();
  }, []);

  const dirty = useMemo(
    () => JSON.stringify(saved) !== JSON.stringify(local),
    [saved, local]
  );

  function Row({ label, prop }: { label: string; prop: keyof UiSettings }) {
    return (
      <label className="flex items-center justify-between gap-4 py-2 border-b">
        <span className="text-sm text-gray-800">{label}</span>
        <input
          type="checkbox"
          checked={!!local[prop]}
          onChange={(e) => setLocal({ ...local, [prop]: e.target.checked })}
        />
      </label>
    );
  }

  async function onSave() {
    try {
      await saveUiSettings(local);
    } catch {}
    // 仍写入本地并广播，以便离线和同页生效
    saveSettings(local);
    setSaved(local);
  }

  function onReset() {
    setLocal(saved);
  }

  function onDefaults() {
    setLocal(defaultSettings());
  }

  return (
    <div className="space-y-6 max-w-xl">
      <h1 className="text-xl font-semibold">设置</h1>
      <div className="rounded border divide-y">
        <Row label="显示顶部进行中状态条" prop="showCurrentBar" />
        <Row label="显示底部汇总条" prop="showBottomSummary" />
        <Row label="显示进度百分比" prop="showProgress" />
        <Row label="显示冲突计数" prop="showConflictCount" />
        <Row label="显示总期望分钟（与可用对比）" prop="showTotalExpected" />
        <Row label="显示压缩/扩张比（实际/期望）" prop="showCompressionRatio" />
        <Row label="显示快捷键提示条" prop="showHotkeyHint" />
        <Row label="锁定结束时间（调整起点时保持结束不变）" prop="lockEndTime" />
        <Row label="自动保存到数据库（开发/个人使用场景）" prop="autoSaveToDb" />
      </div>
      <div className="flex gap-3">
        <button
          className="px-3 py-2 rounded bg-black text-white disabled:opacity-50"
          disabled={!dirty}
          onClick={onSave}
        >保存</button>
        <button className="px-3 py-2 rounded border disabled:opacity-50" disabled={!dirty} onClick={onReset}>撤销修改</button>
        <button className="px-3 py-2 rounded border" onClick={onDefaults}>恢复默认</button>
      </div>
      <p className="text-xs text-gray-500">设置保存在浏览器本地，仅影响本机显示。</p>
    </div>
  );
}
