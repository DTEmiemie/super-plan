'use client';

import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import Link from 'next/link';
import { computeSchedule } from '@/lib/scheduler/compute';
import { DaySchedule, ScheduleTemplate, TemplateSlot, UiSettings } from '@/lib/types';
import { saveTemplate, sampleTemplate, saveScheduleDraft, loadScheduleDraft, clearScheduleDraft, loadSnippetLibrary } from '@/lib/utils/storage';
import { formatClock, hmToMin, minToHm } from '@/lib/utils/time';
import { loadSettings, defaultSettings, KEY as SETTINGS_KEY, saveSettings } from '@/lib/utils/settings';
import { saveUiSettings } from '@/lib/client/api';
import { createTemplate, fetchTemplates, updateTemplate } from '@/lib/client/api';
import { saveScheduleFromDaySchedule } from '@/lib/client/schedules';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { CSS } from '@dnd-kit/utilities';

type Working = {
  id: string;
  name: string;
  wakeStart: string;
  totalHours: number;
  slots: TemplateSlot[];
};

export default function TodayPage() {
  const [working, setWorking] = useState<Working>(() => {
    const tpl = sampleTemplate();
    return { id: tpl.id, name: tpl.name, wakeStart: tpl.wakeStart, totalHours: tpl.totalHours, slots: tpl.slots };
  });
  const [nowStart, setNowStart] = useState<string>('');
  const [nowTick, setNowTick] = useState<number>(() => Date.now());
  const [ui, setUi] = useState<UiSettings>(defaultSettings());
  const [endEdit, setEndEdit] = useState<string>('');
  const [endEditing, setEndEditing] = useState<boolean>(false);
  const [dirty, setDirty] = useState<boolean>(false);
  const [savedSnapshot, setSavedSnapshot] = useState<Working | null>(null);
  const [showDraftPrompt, setShowDraftPrompt] = useState<boolean>(false);
  const saveTimer = (typeof window !== 'undefined') ? (window as any) : {};
  const [focusId, setFocusId] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [tplList, setTplList] = useState<ScheduleTemplate[]>([]);
  const [selectedTplId, setSelectedTplId] = useState<string>('');
  const [pasteOpen, setPasteOpen] = useState<boolean>(false);
  const [pasteText, setPasteText] = useState<string>('');
  const [pasteErrors, setPasteErrors] = useState<string[]>([]);
  const [pasteItems, setPasteItems] = useState<Array<{ id: string; title: string; desiredMin: number; rigid: boolean }>>([]);
  const [pasteIndex, setPasteIndex] = useState<number>(-1);
  const [snipOpen, setSnipOpen] = useState<boolean>(false);
  const [snipIndex, setSnipIndex] = useState<number>(-1);
  const [snippets, setSnippets] = useState<Array<{ title: string; desiredMin: number; rigid?: boolean }>>([]);
  const [splitOpen, setSplitOpen] = useState<boolean>(false);
  const [splitIndex, setSplitIndex] = useState<number>(-1);
  const [splitValue, setSplitValue] = useState<string>('');
  // 起点编辑（避免输入中途失焦/回退）
  const [wakeEdit, setWakeEdit] = useState<string>('');
  const [wakeEditing, setWakeEditing] = useState<boolean>(false);
  // 行内固定开始编辑草稿，键：slotId → 临时字符串
  const [fixedDraft, setFixedDraft] = useState<Record<string, string>>({});

  function openSplit(index: number) {
    const s = working.slots[index];
    if (!s) return;
    const half = Math.max(1, Math.floor((s.desiredMin || 0) / 2));
    setSplitIndex(index);
    setSplitValue(String(half));
    setSplitOpen(true as any);
  }

  // DnD sensors (pointer + keyboard)
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = working.slots.findIndex((sl) => sl.id === String(active.id));
    const newIndex = working.slots.findIndex((sl) => sl.id === String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(working.slots, oldIndex, newIndex);
    setWorking({ ...working, slots: next });
    if (typeof window !== 'undefined') {
      requestAnimationFrame(() => {
        const el = document.getElementById(`tdy-title-${String(active.id)}`) as HTMLInputElement | null;
        el?.focus();
        try { const len = el?.value.length ?? 0; el?.setSelectionRange(len, len); } catch {}
      });
    }
  }

  function Row({ s, idx }: { s: any; idx: number }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: s.id });
    const style: CSSProperties = { transform: CSS.Transform.toString(transform), transition };
    function onRowHotkeys(e: React.KeyboardEvent) {
      if (!e.altKey) return;
      const k = e.key;
      const isMove = k === 'ArrowUp' || k === 'ArrowDown';
      if (isMove || (e.shiftKey && (k === 'c' || k === 'C' || k === 'n' || k === 'N' || k === 'p' || k === 'P' || k === 's' || k === 'S'))) {
        e.preventDefault();
        e.stopPropagation();
      }
      if (k === 'ArrowUp') return moveSlot(idx, -1);
      if (k === 'ArrowDown') return moveSlot(idx, 1);
      if (k === 'c' || k === 'C') return duplicateAt(idx);
      if (k === 'n' || k === 'N') return insertAt(idx, 'below');
      if (k === 'p' || k === 'P') return insertAt(idx, 'above');
      if (k === 's' || k === 'S') return openSplit(idx);
    }
    return (
      <tr key={s.id} ref={setNodeRef} style={style} className={idx === currentIdx ? 'bg-blue-50' : (isDragging ? 'opacity-70' : '')} onKeyDown={onRowHotkeys}>
        <td className="border px-2 py-1 align-middle">
          <button
            className="px-1 py-0.5 border rounded text-xs cursor-grab active:cursor-grabbing select-none"
            aria-label="拖拽排序"
            title="拖拽排序（Space 键进入拖拽；Alt+↑/↓ 移动；Alt+Shift+C 复制；Alt+Shift+N 插入下方；Alt+Shift+P 插入上方；Alt+Shift+S 拆分）"
            {...attributes}
            {...listeners}
            onKeyDown={(e) => {
              if (!e.altKey) return;
              const k = e.key;
              const isMove = k === 'ArrowUp' || k === 'ArrowDown';
              if (isMove || (e.shiftKey && (k === 'c' || k === 'C' || k === 'n' || k === 'N' || k === 'p' || k === 'P' || k === 's' || k === 'S'))) {
                e.preventDefault();
                e.stopPropagation();
              }
              if (k === 'ArrowUp') return moveSlot(idx, -1);
              if (k === 'ArrowDown') return moveSlot(idx, 1);
              if (k === 'c' || k === 'C') return duplicateAt(idx);
              if (k === 'n' || k === 'N') return insertAt(idx, 'below');
              if (k === 'p' || k === 'P') return insertAt(idx, 'above');
              if (k === 's' || k === 'S') return openSplit(idx);
            }}
          >↕</button>
        </td>
        <td className="border px-2 py-1">{idx + 1}</td>
        <td className="border px-2 py-1 text-center">
          <div className="flex items-center justify-center gap-3">
            <span className="text-xs min-w-4 text-gray-500">{s.rigid ? 'R' : 'F'}</span>
            <label className="inline-flex items-center gap-1" title="勾选=R（固定时长）；未勾选=F（自动顺延）">
              <span className="text-xs">R</span>
              <input
                type="checkbox"
                checked={!!s.rigid}
                onChange={(e) => updateSlot(s.id, { rigid: e.target.checked })}
              />
            </label>
          </div>
        </td>
        <td className="border px-2 py-1 text-center">
          <input
            className="border rounded px-2 py-1 w-24 text-center"
            value={fixedDraft[s.id] ?? (s.fixedStart ?? '')}
            placeholder={formatClock(s.start)}
            onFocus={() => setFixedDraft(prev => ({ ...prev, [s.id]: s.fixedStart ?? '' }))}
            onChange={(e) => {
              const v = e.target.value;
              setFixedDraft(prev => ({ ...prev, [s.id]: v }));
              if (/^\d{1,2}:\d{2}$/.test(v)) {
                updateSlot(s.id, { fixedStart: v });
              } else {
                // 未达 HH:mm 前，不写入模型（或清空为未固定）
                updateSlot(s.id, { fixedStart: undefined });
              }
            }}
            onBlur={() => {
              const v = fixedDraft[s.id];
              if (/^\d{1,2}:\d{2}$/.test(v)) updateSlot(s.id, { fixedStart: v });
              else updateSlot(s.id, { fixedStart: undefined });
              setFixedDraft(prev => { const next = { ...prev }; delete next[s.id]; return next; });
            }}
            disabled={!!s.rigid}
          />
        </td>
        <td className="border px-2 py-1">
          <input
            id={`tdy-title-${s.id}`}
            className="border rounded px-2 py-1 w-full"
            value={s.title}
            autoFocus={focusId === s.id}
            onChange={(e) => updateSlot(s.id, { title: e.target.value })}
          />
        </td>
        <td className="border px-2 py-1 text-center">
          <input
            type="number"
            className="border rounded px-2 py-1 w-24 text-right"
            value={s.desiredMin === 0 ? '' : String(s.desiredMin)}
            onChange={(e) => updateSlot(s.id, { desiredMin: Number(e.target.value || 0) })}
          />
        </td>
        <td className="border px-2 py-1 text-right">{Math.round(s.actLen)}</td>
        <td className="border px-2 py-1 text-right">{Math.round(s.optLen)}</td>
        <td className="border px-2 py-1 text-right">{Math.round(s.percent * 100)}</td>
        <td className="border px-2 py-1 text-right">{Math.round(s.delay)}</td>
        <td className="border px-2 py-1 whitespace-nowrap relative">
          <button className="px-2 py-1 border rounded" onClick={() => setMenuOpenId(menuOpenId === s.id ? null : s.id)}>⋯ 操作</button>
          {menuOpenId === s.id ? (
            <div className="absolute z-10 mt-1 bg-white border rounded shadow text-sm right-2" onMouseLeave={() => setMenuOpenId(null)}>
              <button className="block w-full text-left px-3 py-2 hover:bg-gray-50" onClick={() => { insertAt(idx, 'above'); setMenuOpenId(null); }}>上方插入</button>
              <button className="block w-full text-left px-3 py-2 hover:bg-gray-50" onClick={() => { insertAt(idx, 'below'); setMenuOpenId(null); }}>下方插入</button>
              <button className="block w-full text-left px-3 py-2 hover:bg-gray-50" onClick={() => { openPaste(idx + 1); setMenuOpenId(null); }}>批量粘贴（下方）</button>
              <button className="block w-full text-left px-3 py-2 hover:bg-gray-50" onClick={() => { setSnipOpen(true as any); setSnipIndex((idx + 1) as any); setSnippets((loadSnippetLibrary() as any) || []); setMenuOpenId(null); }}>片段库（下方）</button>
              <button className="block w-full text-left px-3 py-2 hover:bg-gray-50" onClick={() => { duplicateAt(idx); setMenuOpenId(null); }}>复制本行</button>
              <button className="block w-full text-left px-3 py-2 hover:bg-gray-50" onClick={() => { moveSlot(idx, -1); setMenuOpenId(null); }}>上移</button>
              <button className="block w-full text-left px-3 py-2 hover:bg-gray-50" onClick={() => { moveSlot(idx, 1); setMenuOpenId(null); }}>下移</button>
            </div>
          ) : null}
        </td>
      </tr>
    );
  }

  useEffect(() => {
    (async () => {
      try {
        const list = await fetchTemplates();
        if (list.length > 0) {
          setTplList(list);
          const t = list[0];
          const w = { id: t.id, name: t.name, wakeStart: t.wakeStart, totalHours: t.totalHours, slots: t.slots };
          setWorking(w);
          setSavedSnapshot(w);
          setSelectedTplId(t.id);
        } else {
          const created = await createTemplate(sampleTemplate());
          setTplList([created]);
          const w = { id: created.id, name: created.name, wakeStart: created.wakeStart, totalHours: created.totalHours, slots: created.slots };
          setWorking(w);
          setSavedSnapshot(w);
          setSelectedTplId(created.id);
        }
      } catch (e) {
        const t = sampleTemplate();
        const w = { id: t.id, name: t.name, wakeStart: t.wakeStart, totalHours: t.totalHours, slots: t.slots };
        setWorking(w);
        setSavedSnapshot(w);
        setTplList([t]);
        setSelectedTplId(t.id);
      }
      setUi(loadSettings());
      // 草稿提示（按日期）
      const today = new Date();
      const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const draft = loadScheduleDraft(date);
      if (draft) setShowDraftPrompt(true);
    })();
  }, []);

  function replaceWorkingFromTemplate(tpl: ScheduleTemplate) {
    const w = { id: tpl.id, name: tpl.name, wakeStart: tpl.wakeStart, totalHours: tpl.totalHours, slots: tpl.slots };
    setWorking(w);
    setSavedSnapshot(w);
    setNowStart('');
  }

  // 实时同步设置：storage 事件（跨标签页）与 BroadcastChannel（同页不同路由）
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === SETTINGS_KEY) {
        setUi(loadSettings());
      }
    }
    window.addEventListener('storage', onStorage);
    let bc: BroadcastChannel | undefined;
    try {
      if ('BroadcastChannel' in window) {
        bc = new BroadcastChannel('super-plan');
        bc.onmessage = (ev) => {
          const data = (ev as MessageEvent).data;
          if (data?.type === 'settings:update' && data?.payload) {
            setUi(data.payload as UiSettings);
          }
        };
      }
    } catch {}
    return () => {
      window.removeEventListener('storage', onStorage);
      try { bc?.close(); } catch {}
    };
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 30000); // 30s 刷新高亮
    return () => clearInterval(id);
  }, []);

  // 开始时间自动顺延，无需手动设置固定开始。

  const schedule: DaySchedule = useMemo(() => {
    const start = nowStart || working.wakeStart;
    const tpl: ScheduleTemplate = { ...working, wakeStart: start } as ScheduleTemplate;
    return computeSchedule({ template: tpl });
  }, [working, nowStart]);

  const totalAct = schedule.slots.reduce((acc, s) => acc + s.actLen, 0);
  const planEndAbs = schedule.slots.reduce((end, s) => Math.max(end, s.start + s.actLen), 0);
  const availableTotal = Math.max(0, Math.round(schedule.totalHours * 60));
  const remainingTotal = Math.max(0, availableTotal - totalAct);

  // 当前进行中的行：now 在 [start, start+actLen) 内
  const now = new Date(nowTick);
  const nowAbs = now.getHours() * 60 + now.getMinutes();
  const currentIdx = schedule.slots.findIndex((s) => nowAbs >= s.start && nowAbs < s.start + s.actLen);
  const currentSlot = currentIdx >= 0 ? schedule.slots[currentIdx] : undefined;
  const currentLeft = currentSlot ? Math.max(0, currentSlot.start + currentSlot.actLen - nowAbs) : 0;

  function updateSlot(id: string, patch: Partial<TemplateSlot>) {
    setWorking((w) => ({
      ...w,
      slots: w.slots.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    }));
  }

  function moveSlot(index: number, dir: -1 | 1) {
    const i = index;
    const j = i + dir;
    if (j < 0 || j >= working.slots.length) return;
    const movedId = working.slots[i]?.id;
    const arr = [...working.slots];
    [arr[i], arr[j]] = [arr[j], arr[i]];
    setWorking({ ...working, slots: arr });
    if (movedId && typeof window !== 'undefined') {
      requestAnimationFrame(() => {
        const el = document.getElementById(`tdy-title-${movedId}`) as HTMLInputElement | null;
        el?.focus();
        try { const len = el?.value.length ?? 0; el?.setSelectionRange(len, len); } catch {}
      });
    }
  }

  function insertAt(index: number, place: 'above' | 'below') {
    const newId = crypto.randomUUID();
    const newSlot: TemplateSlot = {
      id: newId,
      title: '',
      desiredMin: 25,
      rigid: false,
    };
    const arr = [...working.slots];
    const pos = place === 'above' ? index : index + 1;
    arr.splice(pos, 0, newSlot);
    setWorking({ ...working, slots: arr });
    setFocusId(newId);
  }

  function duplicateAt(index: number) {
    const src = working.slots[index];
    if (!src) return;
    const newId = crypto.randomUUID();
    const dup: TemplateSlot = {
      id: newId,
      title: src.title,
      desiredMin: src.desiredMin,
      rigid: src.rigid,
      fixedStart: src.fixedStart,
      tags: src.tags,
    };
    const arr = [...working.slots];
    arr.splice(index + 1, 0, dup);
    setWorking({ ...working, slots: arr });
    setFocusId(newId);
  }

  function openPaste(index: number) {
    setPasteOpen(true);
    setPasteText('');
    setPasteErrors([]);
    setPasteItems([]);
    setPasteIndex(index);
  }

  function parsePaste(text: string) {
    const lines = text.split(/\r?\n/);
    const items: Array<{ id: string; title: string; desiredMin: number; rigid: boolean }> = [];
    const errors: string[] = [];
    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i].trim();
      if (!raw) continue;
      if (raw.startsWith('#')) continue;
      let parts = raw.split('|');
      if (parts.length === 1) parts = raw.split(/\t+/);
      let title = '';
      let minStr = '';
      let mode = '';
      if (parts.length >= 2) {
        title = (parts[0] || '').trim();
        minStr = (parts[1] || '').trim();
        mode = (parts[2] || '').trim();
      } else {
        const m = raw.match(/^(.*?)[\s]+(\d{1,4})$/);
        if (m) {
          title = m[1].trim();
          minStr = m[2].trim();
        } else {
          title = raw;
          minStr = '';
        }
      }
      const desiredMin = minStr ? Math.max(0, parseInt(minStr, 10) || 0) : 25;
      const rigid = /^(r|R|刚性)$/.test(mode);
      if (!title) {
        errors.push(`第 ${i + 1} 行标题为空`);
        continue;
      }
      items.push({ id: crypto.randomUUID(), title, desiredMin, rigid });
    }
    setPasteItems(items);
    setPasteErrors(errors);
  }

  function saveAsTemplate() {
    (async () => {
      const tpl: ScheduleTemplate = {
        id: working.id,
        name: working.name,
        wakeStart: working.wakeStart,
        totalHours: working.totalHours,
        slots: working.slots,
      };
      try {
        const withIndex = { ...tpl, slots: tpl.slots.map((s, i) => ({ ...s, index: i } as any)) } as any;
        const saved = await updateTemplate(tpl.id, withIndex);
        saveTemplate(saved);
        alert('已保存到数据库');
      } catch (e) {
        console.error(e);
        saveTemplate(tpl);
        alert('已保存到本地（数据库保存失败）');
      }
    })();
  }

  return (
    <div className="space-y-4">
      {ui.showHotkeyHint ? (
        <div className="p-2 border rounded bg-gray-50 text-sm flex items-center justify-between">
          <span>
            快捷键：Alt+↑/↓ 移动，Alt+Shift+C 复制，Alt+Shift+N 插入下方，Alt+Shift+P 插入上方，Alt+Shift+S 拆分。焦点在本行任意单元格均可使用；也可拖拽首列“↕”。
          </span>
          <button
            className="px-2 py-1 border rounded"
            onClick={async () => {
              const next = { ...ui, showHotkeyHint: false };
              setUi(next);
              saveSettings(next);
              try { await saveUiSettings({ showHotkeyHint: false }); } catch {}
            }}
          >不再提示</button>
        </div>
      ) : null}
      <h1 className="text-xl font-semibold">今日执行（可编辑表格）</h1>
      <div className="text-sm text-gray-600 -mt-2 mb-2 flex flex-wrap items-center gap-2">
        <span>
          使用模板：<span className="font-medium">{working.name || '默认模板'}</span>
          {(() => {
            const isDefault = selectedTplId && tplList.length > 0 && selectedTplId === tplList[0]?.id;
            return <span className="ml-1 text-gray-500">（{isDefault ? '默认' : '已切换'}）</span>;
          })()}
        </span>
        {tplList.length > 0 ? (
          <>
            <span className="text-gray-400">·</span>
            <label className="inline-flex items-center gap-2">
              <span>切换模板</span>
              <select
                className="border rounded px-2 py-1"
                value={selectedTplId}
                onChange={(e) => {
                  const id = e.target.value;
                  setSelectedTplId(id);
                  const target = tplList.find(t => t.id === id);
                  if (!target) return;
                  // 简单确认：若与初始快照不同，提示覆盖
                  try {
                    const changed = savedSnapshot && JSON.stringify(working) !== JSON.stringify(savedSnapshot);
                    if (changed) {
                      const ok = window.confirm('切换模板将覆盖当前今日表格内容（本地草稿已自动保存）。是否继续？');
                      if (!ok) return;
                    }
                  } catch {}
                  replaceWorkingFromTemplate(target);
                }}
              >
                {tplList.map(t => (
                  <option key={t.id} value={t.id}>{t.name || '未命名模板'}</option>
                ))}
              </select>
            </label>
          </>
        ) : null}
        <Link href="/templates" className="ml-3 text-gray-700 underline-offset-2 hover:underline">管理模板</Link>
      </div>
      {showDraftPrompt ? (
        <div className="p-3 border rounded bg-amber-50 text-sm text-amber-800 flex items-center justify-between">
          <span>检测到当日草稿，是否恢复未保存的更改？</span>
          <div className="flex gap-2">
            <button className="px-2 py-1 border rounded" onClick={() => {
              const today = new Date();
              const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
              const d = loadScheduleDraft(date);
              if (d) setWorking(d.data as Working);
              setShowDraftPrompt(false);
            }}>恢复</button>
            <button className="px-2 py-1 border rounded" onClick={() => {
              const today = new Date();
              const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
              clearScheduleDraft(date);
              setShowDraftPrompt(false);
            }}>丢弃</button>
          </div>
        </div>
      ) : null}

      {snipOpen ? (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-20">
          <div className="bg-white w-[720px] max-w-[95vw] rounded border shadow p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">片段库</h2>
              <button className="px-2 py-1 border rounded" onClick={() => setSnipOpen(false as any)}>关闭</button>
            </div>
            <div className="grid grid-cols-2 gap-2 max-h-56 overflow-auto">
              {snippets.map((it, i) => (
                <div key={i} className="flex items-center justify-between border rounded px-2 py-1">
                  <div className="text-sm">{it.title} · {it.desiredMin} min {it.rigid ? '· R' : ''}</div>
                  <div className="space-x-2">
                    <button className="px-2 py-1 border rounded" onClick={() => {
                      const newId = crypto.randomUUID();
                      const newSlot: TemplateSlot = { id: newId, title: it.title, desiredMin: it.desiredMin, rigid: !!it.rigid };
                      const arr = [...working.slots];
                      const pos = snipIndex < 0 ? arr.length : Math.min(Math.max(0, snipIndex as any), arr.length);
                      arr.splice(pos, 0, newSlot);
                      setWorking({ ...working, slots: arr });
                      setFocusId(newId);
                      setSnipOpen(false as any);
                    }}>插入</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {splitOpen ? (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-20">
          <div className="bg-white w-[420px] max-w-[95vw] rounded border shadow p-4 space-y-3">
            <h2 className="text-base font-semibold">拆分本行</h2>
            <div className="text-sm text-gray-700">将此行拆分为两段。请输入第一段的分钟数。</div>
            <div className="flex items-center gap-2">
              <input className="border rounded px-2 py-1 w-28 text-right" value={splitValue} onChange={(e) => setSplitValue(e.target.value)} />
              <span className="text-sm text-gray-600">分钟</span>
              <button className="px-2 py-1 border rounded" onClick={() => {
                const s = working.slots[splitIndex as any];
                if (!s) return;
                const half = Math.max(1, Math.floor((s.desiredMin || 0) / 2));
                setSplitValue(String(half));
              }}>平分</button>
            </div>
            <div className="text-right space-x-2">
              <button className="px-3 py-1 border rounded" onClick={() => setSplitOpen(false as any)}>取消</button>
              <button className="px-3 py-1 rounded bg-black text-white" onClick={() => {
                const idx = splitIndex as any;
                const s = working.slots[idx];
                if (!s) { setSplitOpen(false as any); return; }
                const first = Math.max(1, Math.min(s.desiredMin - 1, parseInt(splitValue || '0', 10) || 0));
                const second = s.desiredMin - first;
                const arr = [...working.slots];
                arr[idx] = { ...s, desiredMin: first, fixedStart: undefined };
                arr.splice(idx + 1, 0, { ...s, id: crypto.randomUUID(), desiredMin: second, fixedStart: undefined });
                setWorking({ ...working, slots: arr });
                setSplitOpen(false as any);
              }}>确定</button>
            </div>
          </div>
        </div>
      ) : null}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
        <label className="text-sm text-gray-700 flex flex-col gap-1">
          起点（HH:mm）
          <input
            className="border rounded px-2 py-1"
            value={wakeEditing ? wakeEdit : (working.wakeStart || '')}
            onFocus={() => { setWakeEditing(true); setWakeEdit(working.wakeStart || ''); }}
            onChange={(e) => {
              const val = e.target.value;
              setWakeEdit(val);
              if (/^\d{1,2}:\d{2}$/.test(val)) {
                if (ui.lockEndTime) {
                  const prevStart = hmToMin(working.wakeStart || '00:00');
                  const prevEndAbs = (prevStart + Math.max(0, working.totalHours || 0) * 60) % (24 * 60);
                  const newStart = hmToMin(val || '00:00');
                  const delta = (prevEndAbs - newStart + 1440) % 1440;
                  setWorking({ ...working, wakeStart: val, totalHours: Math.round(delta) / 60 });
                } else {
                  setWorking({ ...working, wakeStart: val });
                }
              }
            }}
            onBlur={() => { setWakeEditing(false); setWakeEdit(''); }}
          />
        </label>
        <label className="text-sm text-gray-700 flex flex-col gap-1">
          总时长（小时）
          <div className="flex items-center gap-2">
            <input
              type="number"
              className="border rounded px-2 py-1"
              value={working.totalHours === 0 ? '' : String(working.totalHours)}
              onChange={(e) => setWorking({ ...working, totalHours: Number(e.target.value || 0) })}
            />
            <button
              className="px-2 py-1 border rounded"
              title="-15 分钟"
              onClick={() => {
                const next = Math.max(0, Math.min(24, (working.totalHours || 0) - 0.25));
                setWorking({ ...working, totalHours: Number(next.toFixed(2)) });
              }}
            >-15</button>
            <button
              className="px-2 py-1 border rounded"
              title="+15 分钟"
              onClick={() => {
                const next = Math.max(0, Math.min(24, (working.totalHours || 0) + 0.25));
                setWorking({ ...working, totalHours: Number(next.toFixed(2)) });
              }}
            >+15</button>
          </div>
        </label>
        <button
          className="h-10 px-3 rounded bg-black text-white"
          onClick={() => {
            const d = new Date();
            const hh = String(d.getHours()).padStart(2, '0');
            const mm = String(d.getMinutes()).padStart(2, '0');
            const hm = `${hh}:${mm}`;
            // 锁定结束时保持结束不变
            if (ui.lockEndTime) {
              const prevStart = hmToMin(working.wakeStart || '00:00');
              const prevEndAbs = (prevStart + Math.max(0, working.totalHours || 0) * 60) % (24 * 60);
              const newStart = hmToMin(hm);
              const delta = (prevEndAbs - newStart + 1440) % 1440;
              setWorking({ ...working, wakeStart: hm, totalHours: Math.round(delta) / 60 });
            } else {
              setWorking((w) => ({ ...w, wakeStart: hm }));
            }
            setNowStart(hm);
          }}
        >以当前时间开始</button>
        {ui.showConflictCount ? (
          <div className="text-sm text-gray-600">{schedule.warnings?.length ? `⚠️ ${schedule.warnings.length} 处约束冲突` : '无冲突'}</div>
        ) : null}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
        <div className="text-sm text-gray-700 flex flex-col gap-1">
          结束（HH:mm）
          <div className="flex items-center gap-2">
            <input
              className="border rounded px-2 py-1 w-28 text-center"
              value={endEditing ? endEdit : minToHm((hmToMin(working.wakeStart || '00:00') + Math.max(0, working.totalHours || 0) * 60) % (24 * 60))}
              onFocus={() => { setEndEditing(true); setEndEdit(minToHm((hmToMin(working.wakeStart || '00:00') + Math.max(0, working.totalHours || 0) * 60) % (24 * 60))); }}
              onChange={(e) => {
                const v = e.target.value;
                setEndEdit(v);
                const m = v.match(/^(\d{1,2}):(\d{2})$/);
                if (!m) return;
                const start = hmToMin(working.wakeStart || '00:00');
                const hh = Number(m[1]);
                const mm = Number(m[2]);
                const end = ((hh % 24) * 60 + mm) % (24 * 60);
                const delta = (end - start + 1440) % 1440;
                setWorking({ ...working, totalHours: Math.round(delta) / 60 });
              }}
              onBlur={() => { setEndEditing(false); setEndEdit(''); }}
              placeholder={minToHm((hmToMin(working.wakeStart || '00:00') + Math.max(0, working.totalHours || 0) * 60) % (24 * 60))}
            />
            {(() => {
              const start = hmToMin(working.wakeStart || '00:00');
              const crossDay = (start + Math.max(0, working.totalHours || 0) * 60) >= 1440;
              return crossDay ? <span className="text-xs text-amber-700">跨日</span> : null;
            })()}
            <button className="px-2 py-1 border rounded" onClick={() => {
              const end = (hmToMin(working.wakeStart || '00:00') + Math.max(0, working.totalHours || 0) * 60) % (24 * 60);
              const hhmm = minToHm(end);
              const start = hmToMin(working.wakeStart || '00:00');
              const delta = (end - start + 1440) % 1440;
              setWorking({ ...working, totalHours: Math.round(delta) / 60 });
            }}>按结束回填</button>
            <button className="px-2 py-1 border rounded" onClick={() => setWorking({ ...working, totalHours: Math.round(totalAct) / 60 })}>按内容回填</button>
          </div>
        </div>
      </div>

      {ui.showCurrentBar && currentSlot ? (
        <div className="text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded px-3 py-2">
          进行中：{currentSlot.title} · 剩余 {currentLeft} 分钟 · 结束于 {formatClock(currentSlot.start + currentSlot.actLen)}
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table className="min-w-full border text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="border px-2 py-1 text-left w-10">拖</th>
              <th className="border px-2 py-1 text-left">序</th>
              <th className="border px-2 py-1">F / R</th>
              <th className="border px-2 py-1">开始</th>
              <th className="border px-2 py-1 text-left">标题</th>
              <th className="border px-2 py-1">期望（min）</th>
              <th className="border px-2 py-1">实际（min）</th>
              <th className="border px-2 py-1">最优（min）</th>
              <th className="border px-2 py-1">达成（%）</th>
              <th className="border px-2 py-1">延迟（min）</th>
              <th className="border px-2 py-1">
                <div className="flex items-center justify-between">
                  <span>操作</span>
                  <div className="space-x-2">
                    <button className="px-2 py-1 border rounded" onClick={() => openPaste(working.slots.length)}>批量粘贴</button>
                    <button className="px-2 py-1 border rounded" onClick={() => { setSnipOpen(true as any); setSnipIndex(working.slots.length as any); setSnippets((loadSnippetLibrary() as any) || []); }}>片段库</button>
                  </div>
                </div>
              </th>
            </tr>
          </thead>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis]}
            onDragEnd={onDragEnd}
          >
            <SortableContext items={schedule.slots.map((s) => s.id)} strategy={verticalListSortingStrategy}>
              <tbody>
                {schedule.slots.map((s, idx) => (
                  <Row key={s.id} s={s} idx={idx} />
                ))}
              </tbody>
            </SortableContext>
          </DndContext>
          <tfoot>
            <tr>
              <td className="border px-2 py-1" colSpan={6}>合计</td>
              <td className="border px-2 py-1 text-right">{Math.round(totalAct)}</td>
              <td className="border px-2 py-1" colSpan={4}></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {schedule.warnings?.length ? (
        <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-3">
          <div className="font-medium mb-1">约束冲突与提示</div>
          <ul className="list-disc pl-5">
            {schedule.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex gap-3">
        <button
          className="px-3 py-2 rounded bg-black text-white"
          onClick={async () => {
            try {
              // 保存当日计划到数据库（主操作）
              const tpl: ScheduleTemplate = {
                id: working.id,
                name: working.name,
                wakeStart: working.wakeStart,
                totalHours: working.totalHours,
                slots: working.slots,
              };
              await saveScheduleFromDaySchedule(tpl, schedule);
              alert('已保存当日计划');
            } catch (e) {
              console.error(e);
              const msg = e instanceof Error ? e.message : '保存失败';
              alert(msg);
            }
          }}
        >保存当日计划</button>
        <button className="px-3 py-2 rounded border" onClick={saveAsTemplate}>保存为模板</button>
        {dirty ? <span className="text-sm text-blue-700">未保存更改（草稿已自动保存）</span> : null}
        {nowStart && (
          <button className="px-3 py-2 rounded border" onClick={() => setNowStart('')}>重置起点</button>
        )}
      </div>

      <p className="text-xs text-gray-500">
        说明：当前已支持 F（固定开始）/ R（刚性）与分段按比例缩放；当刚性总长超出段时间，会给出冲突提示。
      </p>

      {pasteOpen ? (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-20">
          <div className="bg-white w-[720px] max-w-[95vw] rounded border shadow p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">批量粘贴</h2>
              <button className="px-2 py-1 border rounded" onClick={() => setPasteOpen(false)}>关闭</button>
            </div>
            <div className="text-xs text-gray-600">
              支持格式：
              <ul className="list-disc pl-4">
                <li>标题｜分钟｜F/R（例如：运动｜45｜R）</li>
                <li>标题｜分钟（例如：阅读｜30）</li>
                <li>仅标题（分钟默认 25，F）</li>
              </ul>
            </div>
            <textarea
              className="w-full h-40 border rounded p-2 font-mono text-sm"
              value={pasteText}
              onChange={(e) => { setPasteText(e.target.value); parsePaste(e.target.value); }}
              placeholder={"阅读|30\n运动|45|R"}
            />
            <div className="text-sm flex items-center justify-between">
              <span>解析结果：{pasteItems.length} 条；错误：{pasteErrors.length} 条</span>
              <div className="space-x-2">
                <button className="px-3 py-1 border rounded" onClick={() => parsePaste(pasteText)}>重新解析</button>
                <button
                  className="px-3 py-1 rounded bg-black text-white disabled:opacity-50"
                  disabled={pasteItems.length === 0 || pasteErrors.length > 0}
                  onClick={() => {
                    const arr = [...working.slots];
                    const pos = pasteIndex < 0 ? arr.length : Math.min(Math.max(0, pasteIndex), arr.length);
                    arr.splice(pos, 0, ...pasteItems.map(it => ({ ...it })) as any);
                    setWorking({ ...working, slots: arr });
                    setFocusId(pasteItems[0]?.id || null);
                    setPasteOpen(false);
                  }}
                >插入到{pasteIndex < 0 ? '末尾' : `第 ${pasteIndex} 行之后`}</button>
              </div>
            </div>
            {pasteErrors.length > 0 ? (
              <div className="text-xs text-red-600 max-h-24 overflow-auto border rounded p-2 bg-red-50">
                {pasteErrors.slice(0, 10).map((e, i) => (<div key={i}>{e}</div>))}
                {pasteErrors.length > 10 ? <div>… 还有 {pasteErrors.length - 10} 条</div> : null}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {ui.showBottomSummary ? (
        <div className="sticky bottom-0 left-0 right-0 bg-white border-t py-2 mt-8">
          <div className="flex justify-between items-center text-sm text-gray-700">
            <div className="flex items-center gap-2">计划结束：
              {(() => {
                const endClock = planEndAbs % (24 * 60);
                const startClock = hmToMin(working.wakeStart || '00:00');
                const crossDay = endClock < startClock;
                return (
                  <>
                    <span>{formatClock(planEndAbs)}</span>
                    {crossDay ? <span className="text-amber-700 text-xs">跨日</span> : null}
                  </>
                );
              })()}
              <button className="ml-2 px-2 py-1 border rounded" onClick={() => {
                const start = hmToMin(working.wakeStart || '00:00');
                const end = planEndAbs % (24 * 60);
                const delta = (end - start + 1440) % 1440;
                setWorking({ ...working, totalHours: Math.round(delta) / 60 });
              }}>设为结束</button>
            </div>
            <div className="flex gap-3 items-center">
              <span>总实际：{Math.round(totalAct)} 分钟</span>
              <span>剩余：{Math.round(remainingTotal)} 分钟</span>
              {ui.showTotalExpected ? (
                <span>总期望：{Math.round(schedule.slots.reduce((a, s) => a + s.optLen, 0))} 分钟 / 可用：{Math.round(availableTotal)} 分钟</span>
              ) : null}
              {ui.showCompressionRatio ? (
                <span>压缩比：{(schedule.slots.reduce((a, s) => a + s.actLen, 0) / Math.max(1, schedule.slots.reduce((a, s) => a + s.optLen, 0)) * 100).toFixed(0)}%</span>
              ) : null}
              {ui.showProgress ? (
                <span>进度：{Math.min(100, Math.max(0, Math.round(((nowAbs - (Number(working.wakeStart.split(':')[0]) * 60 + Number(working.wakeStart.split(':')[1]))) / Math.max(1, availableTotal)) * 100)))}%</span>
              ) : null}
              <div className="flex items-center gap-1">
                <button
                  className="px-2 py-1 border rounded"
                  title="-15 分钟"
                  onClick={() => {
                    const next = Math.max(0, Math.min(24, (working.totalHours || 0) - 0.25));
                    setWorking({ ...working, totalHours: Number(next.toFixed(2)) });
                  }}
                >-15</button>
                <button
                  className="px-2 py-1 border rounded"
                  title="+15 分钟"
                  onClick={() => {
                    const next = Math.max(0, Math.min(24, (working.totalHours || 0) + 0.25));
                    setWorking({ ...working, totalHours: Number(next.toFixed(2)) });
                  }}
                >+15</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
