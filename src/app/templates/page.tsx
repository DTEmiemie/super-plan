'use client';

import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { ScheduleTemplate, TemplateSlot, UiSettings } from '@/lib/types';
import { saveTemplate, sampleTemplate, saveTemplateDraft, loadTemplateDraft, clearTemplateDraft, loadSnippetLibrary, saveSnippetLibrary } from '@/lib/utils/storage';
import { fetchSnippets, createSnippet, deleteSnippet, deleteTemplate } from '@/lib/client/api';
import { createTemplate, fetchTemplates, updateTemplate } from '@/lib/client/api';
import { defaultSettings, loadSettings, saveSettings } from '@/lib/utils/settings';
import { saveUiSettings } from '@/lib/client/api';
import { computeSchedule } from '@/lib/scheduler/compute';
import { hmToMin, minToHm } from '@/lib/utils/time';
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

export default function TemplatesPage() {
  const [template, setTemplate] = useState<ScheduleTemplate>(sampleTemplate());
  const [ui, setUi] = useState<UiSettings>(defaultSettings());
  const [tplList, setTplList] = useState<ScheduleTemplate[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [endEdit, setEndEdit] = useState<string>('');
  const [endEditing, setEndEditing] = useState<boolean>(false);
  const [savedSnapshot, setSavedSnapshot] = useState<ScheduleTemplate | null>(null);
  const [dirty, setDirty] = useState<boolean>(false);
  const [showDraftPrompt, setShowDraftPrompt] = useState<boolean>(false);
  const [hasDraft, setHasDraft] = useState<boolean>(false);
  const saveTimer = (typeof window !== 'undefined') ? (window as any) : {};
  const [saving, setSaving] = useState<boolean>(false);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [pasteOpen, setPasteOpen] = useState<boolean>(false);
  const [pasteText, setPasteText] = useState<string>('');
  const [pasteErrors, setPasteErrors] = useState<string[]>([]);
  const [pasteItems, setPasteItems] = useState<Array<{ id: string; title: string; desiredMin: number; rigid: boolean }>>([]);
  const [pasteIndex, setPasteIndex] = useState<number>(-1); // -1 末尾
  const [snipOpen, setSnipOpen] = useState<boolean>(false);
  const [snipIndex, setSnipIndex] = useState<number>(-1);
  const [snippets, setSnippets] = useState<Array<{ title: string; desiredMin: number; rigid?: boolean }>>([]);
  const [snipTitle, setSnipTitle] = useState<string>('');
  const [snipMin, setSnipMin] = useState<string>('25');
  const [snipRigid, setSnipRigid] = useState<boolean>(false);
  const [splitOpen, setSplitOpen] = useState<boolean>(false);
  const [splitIndex, setSplitIndex] = useState<number>(-1);
  const [splitValue, setSplitValue] = useState<string>('');

  // DnD sensors (pointer + keyboard)
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = template.slots.findIndex((s) => s.id === String(active.id));
    const newIndex = template.slots.findIndex((s) => s.id === String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(template.slots, oldIndex, newIndex);
    setTemplate({ ...template, slots: next });
    // 维持焦点在移动的这一行标题
    if (typeof window !== 'undefined') {
      requestAnimationFrame(() => {
        const el = document.getElementById(`tpl-title-${String(active.id)}`) as HTMLInputElement | null;
        el?.focus();
        try { const len = el?.value.length ?? 0; el?.setSelectionRange(len, len); } catch {}
      });
    }
  }

  // Row component for sortable integration
  function Row({ s, idx }: { s: TemplateSlot; idx: number }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: s.id });
    const style: CSSProperties = { transform: CSS.Transform.toString(transform), transition };
    function onRowHotkeys(e: React.KeyboardEvent) {
      // 统一在整行捕获，输入框也可触发；使用 Alt+Shift 组合避免浏览器冲突
      // 支持 Alt+↑/↓（仅移动），以及 Alt+Shift 组合（全部操作）
      if (!(e.altKey)) return;
      const k = e.key;
      const isMove = k === 'ArrowUp' || k === 'ArrowDown';
      const needShift = !(isMove); // 非移动操作要求同时按下 Shift
      if ((isMove || (e.shiftKey && (k === 'c' || k === 'C' || k === 'n' || k === 'N' || k === 'p' || k === 'P' || k === 's' || k === 'S')))) {
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
      <tr ref={setNodeRef} style={style} className={isDragging ? 'opacity-70' : ''} onKeyDown={onRowHotkeys}>
        <td className="border px-2 py-1 align-middle">
          <button
            className="px-1 py-0.5 border rounded text-xs cursor-grab active:cursor-grabbing select-none"
            aria-label="拖拽排序"
            title="拖拽排序（Space 键进入拖拽；Alt+↑/↓ 移动；Alt+Shift+C 复制；Alt+Shift+N 插入下方；Alt+Shift+P 插入上方；Alt+Shift+S 拆分）"
            {...attributes}
            {...listeners}
            onKeyDown={(e) => {
              // 手柄上也支持相同快捷键（Alt+Shift 组合）
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
        <td className="border px-2 py-1 whitespace-nowrap">{idx + 1}</td>
        <td className="border px-2 py-1">
          <input
            id={`tpl-title-${s.id}`}
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
        <td className="border px-2 py-1 whitespace-nowrap relative">
          <button
            className="px-2 py-1 border rounded"
            onClick={() => setMenuOpenId(menuOpenId === s.id ? null : s.id)}
          >⋯ 操作</button>
          {menuOpenId === s.id ? (
            <div
              className="absolute z-10 mt-1 bg-white border rounded shadow text-sm right-2"
              onMouseLeave={() => setMenuOpenId(null)}
            >
              <button className="block w-full text-left px-3 py-2 hover:bg-gray-50" onClick={() => { insertAt(idx, 'above'); setMenuOpenId(null); }}>上方插入</button>
              <button className="block w-full text-left px-3 py-2 hover:bg-gray-50" onClick={() => { insertAt(idx, 'below'); setMenuOpenId(null); }}>下方插入</button>
              <button className="block w-full text-left px-3 py-2 hover:bg-gray-50" onClick={() => { openPaste(idx + 1); setMenuOpenId(null); }}>批量粘贴（下方）</button>
              <button className="block w-full text-left px-3 py-2 hover:bg-gray-50" onClick={() => { openSnippets(idx + 1); setMenuOpenId(null); }}>片段库（下方）</button>
              <button className="block w-full text-left px-3 py-2 hover:bg-gray-50" onClick={() => { openSplit(idx); setMenuOpenId(null); }}>拆分本行</button>
              <button className="block w-full text-left px-3 py-2 hover:bg-gray-50" onClick={() => { duplicateAt(idx); setMenuOpenId(null); }}>复制本行</button>
              <button className="block w-full text-left px-3 py-2 hover:bg-gray-50" onClick={() => { moveSlot(idx, -1); setMenuOpenId(null); }}>上移</button>
              <button className="block w-full text-left px-3 py-2 hover:bg-gray-50" onClick={() => { moveSlot(idx, 1); setMenuOpenId(null); }}>下移</button>
              <button className="block w-full text-left px-3 py-2 hover:bg-red-50 text-red-600" onClick={() => { removeSlot(s.id); setMenuOpenId(null); }}>删除</button>
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
          setTemplate(list[0]);
          setSavedSnapshot(list[0]);
          setSelectedId(list[0].id);
          // 草稿提示
          const draft = loadTemplateDraft(list[0].id);
          if (draft) {
            setHasDraft(true);
            setShowDraftPrompt(true);
          }
        } else {
          const created = await createTemplate(sampleTemplate());
          setTplList([created]);
          setTemplate(created);
          setSavedSnapshot(created);
          setSelectedId(created.id);
        }
      } catch (e) {
        // fallback to local sample
        const t = sampleTemplate();
        setTemplate(t);
        setTplList([t]);
        setSelectedId(t.id);
      }
      setUi(loadSettings());
    })();
  }, []);

  function switchTo(t: ScheduleTemplate) {
    setTemplate(t);
    setSavedSnapshot(t);
    setSelectedId(t.id);
    // 切换后检查草稿
    const draft = loadTemplateDraft(t.id);
    if (draft) { setHasDraft(true); setShowDraftPrompt(true); } else { setHasDraft(false); setShowDraftPrompt(false); }
  }

  async function onCreateNew() {
    const payload: Partial<ScheduleTemplate> = {
      name: '新模板',
      wakeStart: '07:00',
      totalHours: 16,
      slots: [],
    } as any;
    try {
      const created = await createTemplate(payload);
      const next = [...tplList, created];
      setTplList(next);
      switchTo(created);
    } catch (e) {
      alert('创建模板失败');
    }
  }

  async function onDuplicate() {
    try {
      const withIndex: any = {
        name: `${template.name || '模板'}（副本）`,
        wakeStart: template.wakeStart,
        totalHours: template.totalHours,
        slots: template.slots.map((s, i) => ({ title: s.title, desiredMin: s.desiredMin, rigid: !!s.rigid, fixedStart: s.fixedStart ?? null, tags: s.tags ?? null, index: i })),
      };
      const created = await createTemplate(withIndex);
      const next = [...tplList, created];
      setTplList(next);
      switchTo(created);
    } catch (e) {
      console.error(e);
      alert('复制失败，请稍后再试');
    }
  }

  async function onDeleteCurrent() {
    if (tplList.length <= 1) { alert('至少保留一个模板'); return; }
    const ok = window.confirm(`确定删除模板「${template.name}」？此操作不可撤销。`);
    if (!ok) return;
    try {
      await deleteTemplate(template.id);
      clearTemplateDraft(template.id);
      const next = tplList.filter(t => t.id !== template.id);
      setTplList(next);
      switchTo(next[0]);
    } catch (e) {
      console.error(e);
      alert('删除失败，请检查控制台');
    }
  }

  // 开始时间自动顺延（基于实际分钟），无需手动编辑。

  const totalDesired = useMemo(
    () => template.slots.reduce((acc, s) => acc + s.desiredMin, 0),
    [template]
  );

  const endHm = useMemo(() => {
    const start = hmToMin(template.wakeStart || '00:00');
    const end = (start + Math.max(0, template.totalHours || 0) * 60) % (24 * 60);
    return minToHm(end);
  }, [template.wakeStart, template.totalHours]);

  function onWakeStartChange(val: string) {
    if (!ui.lockEndTime) {
      setTemplate({ ...template, wakeStart: val });
      return;
    }
    // 保持结束不变
    const prevStart = hmToMin(template.wakeStart || '00:00');
    const prevEndAbs = (prevStart + Math.max(0, template.totalHours || 0) * 60) % (24 * 60);
    const newStart = hmToMin(val || '00:00');
    const delta = (prevEndAbs - newStart + 1440) % 1440; // 分钟
    setTemplate({ ...template, wakeStart: val, totalHours: Math.round(delta) / 60 });
  }

  function onEndChange(hhmm: string) {
    const start = hmToMin(template.wakeStart || '00:00');
    const m = hhmm.match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return; // 非法则忽略
    const hh = Number(m[1]);
    const mm = Number(m[2]);
    const end = ((hh % 24) * 60 + mm) % (24 * 60);
    const delta = (end - start + 1440) % 1440;
    setTemplate({ ...template, totalHours: Math.round(delta) / 60 });
  }

  function fillFromContent() {
    try {
      const sch = computeSchedule({ template });
      const totalAct = sch.slots.reduce((a, s) => a + s.actLen, 0);
      setTemplate({ ...template, totalHours: Math.round(totalAct) / 60 });
    } catch {}
  }

  function addSlot() {
    const next: TemplateSlot = {
      id: crypto.randomUUID(),
      title: '新时段',
      desiredMin: 30,
      rigid: false,
    };
    setTemplate({ ...template, slots: [...template.slots, next] });
  }

  function updateSlot(id: string, patch: Partial<TemplateSlot>) {
    setTemplate({
      ...template,
      slots: template.slots.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    });
  }

  function removeSlot(id: string) {
    setTemplate({ ...template, slots: template.slots.filter((s) => s.id !== id) });
  }

  function moveSlot(index: number, dir: -1 | 1) {
    const i = index;
    const j = i + dir;
    if (j < 0 || j >= template.slots.length) return;
    const movedId = template.slots[i]?.id;
    const arr = [...template.slots];
    [arr[i], arr[j]] = [arr[j], arr[i]];
    setTemplate({ ...template, slots: arr });
    if (movedId && typeof window !== 'undefined') {
      requestAnimationFrame(() => {
        const el = document.getElementById(`tpl-title-${movedId}`) as HTMLInputElement | null;
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
    const arr = [...template.slots];
    const pos = place === 'above' ? index : index + 1;
    arr.splice(pos, 0, newSlot);
    setTemplate({ ...template, slots: arr });
    setFocusId(newId);
  }

  function duplicateAt(index: number) {
    const src = template.slots[index];
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
    const arr = [...template.slots];
    arr.splice(index + 1, 0, dup);
    setTemplate({ ...template, slots: arr });
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
        // 尝试匹配“标题 + 空格 + 分钟”
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

  async function openSnippets(index: number) {
    setSnipOpen(true);
    setSnipIndex(index);
    try {
      const remote = await fetchSnippets();
      setSnippets(remote);
    } catch {
      setSnippets(loadSnippetLibrary());
    }
    setSnipTitle('');
    setSnipMin('25');
    setSnipRigid(false);
  }

  function insertSnippet(item: { title: string; desiredMin: number; rigid?: boolean }) {
    const newId = crypto.randomUUID();
    const newSlot: TemplateSlot = { id: newId, title: item.title, desiredMin: item.desiredMin, rigid: !!item.rigid };
    const arr = [...template.slots];
    const pos = snipIndex < 0 ? arr.length : Math.min(Math.max(0, snipIndex), arr.length);
    arr.splice(pos, 0, newSlot);
    setTemplate({ ...template, slots: arr });
    setFocusId(newId);
    setSnipOpen(false);
  }

  function openSplit(index: number) {
    const s = template.slots[index];
    if (!s) return;
    const half = Math.max(1, Math.floor((s.desiredMin || 0) / 2));
    setSplitIndex(index);
    setSplitValue(String(half));
    setSplitOpen(true);
  }

  function doSplit() {
    const idx = splitIndex;
    const s = template.slots[idx];
    if (!s) { setSplitOpen(false); return; }
    const first = Math.max(1, Math.min(s.desiredMin - 1, parseInt(splitValue || '0', 10) || 0));
    const second = s.desiredMin - first;
    const arr = [...template.slots];
    arr[idx] = { ...s, desiredMin: first, fixedStart: undefined };
    arr.splice(idx + 1, 0, { ...s, id: crypto.randomUUID(), desiredMin: second, fixedStart: undefined });
    setTemplate({ ...template, slots: arr });
    setSplitOpen(false);
  }

  // 变更检测
  useEffect(() => {
    if (!savedSnapshot) return;
    const a = JSON.stringify({ ...template, updatedAt: undefined });
    const b = JSON.stringify({ ...savedSnapshot, updatedAt: undefined });
    setDirty(a !== b);
  }, [template, savedSnapshot]);

  // 草稿自动保存（2s 节流）
  useEffect(() => {
    if (!template?.id) return;
    if ((saveTimer as any)._tpl) clearTimeout((saveTimer as any)._tpl);
    (saveTimer as any)._tpl = setTimeout(() => {
      saveTemplateDraft(template.id, template);
    }, 2000);
    return () => {
      if ((saveTimer as any)._tpl) clearTimeout((saveTimer as any)._tpl);
    };
  }, [template]);

  // 离开提示
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  async function saveToDb() {
    try {
      setSaving(true);
      const withIndex = { ...template, slots: template.slots.map((s, i) => ({ ...s, index: i } as any)) } as any;
      const saved = await updateTemplate(template.id, withIndex);
      setTemplate(saved);
      setSavedSnapshot(saved);
      // 同步更新下拉列表中的名称等信息
      setTplList((prev) => {
        const idx = prev.findIndex((t) => t.id === saved.id);
        if (idx < 0) return prev;
        const next = prev.slice();
        next[idx] = saved;
        return next;
      });
      setSelectedId(saved.id);
      saveTemplate(saved);
      clearTemplateDraft(template.id);
      setHasDraft(false);
    } finally {
      setSaving(false);
    }
  }

  // 自动保存到数据库（可选，2.5s）
  useEffect(() => {
    if (!ui.autoSaveToDb) return;
    if (!dirty) return;
    if ((saveTimer as any)._tpl_db) clearTimeout((saveTimer as any)._tpl_db);
    (saveTimer as any)._tpl_db = setTimeout(() => {
      saveToDb().catch(() => {});
    }, 2500);
    return () => {
      if ((saveTimer as any)._tpl_db) clearTimeout((saveTimer as any)._tpl_db);
    };
  }, [template, ui.autoSaveToDb, dirty]);

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
      {showDraftPrompt && hasDraft && savedSnapshot ? (
        <div className="p-3 border rounded bg-amber-50 text-sm text-amber-800 flex items-center justify-between">
          <span>检测到草稿，是否恢复未保存的更改？</span>
          <div className="flex gap-2">
            <button className="px-2 py-1 border rounded" onClick={() => {
              const d = loadTemplateDraft(savedSnapshot.id);
              if (d) setTemplate(d.data);
              setShowDraftPrompt(false);
            }}>恢复</button>
            <button className="px-2 py-1 border rounded" onClick={() => { if (savedSnapshot) clearTemplateDraft(savedSnapshot.id); setHasDraft(false); setShowDraftPrompt(false); }}>丢弃</button>
          </div>
        </div>
      ) : null}
      {dirty ? (
        <div className="p-2 border rounded bg-blue-50 text-sm text-blue-800 flex items-center justify-between">
          <span>未保存更改（草稿已自动保存）</span>
          <div className="flex gap-2 items-center">
            <button disabled={saving} className="px-2 py-1 border rounded bg-black text-white disabled:opacity-50" onClick={saveToDb}>保存</button>
            <button className="px-2 py-1 border rounded" onClick={() => { if (savedSnapshot) { setTemplate(savedSnapshot); if (savedSnapshot.id) clearTemplateDraft(savedSnapshot.id); } }}>丢弃更改</button>
          </div>
        </div>
      ) : null}
      <h1 className="text-xl font-semibold">模板编辑</h1>
      <div className="flex flex-wrap items-end gap-3 text-sm">
        <label className="flex items-center gap-2">
          <span>当前模板</span>
          <select
            className="border rounded px-2 py-1"
            value={selectedId}
            onChange={(e) => {
              const target = tplList.find(t => t.id === e.target.value);
              if (!target) return;
              if (dirty) {
                const ok = window.confirm('切换模板将丢弃未保存的更改（草稿已自动保存）。是否继续？');
                if (!ok) { setSelectedId(template.id); return; }
              }
              switchTo(target);
            }}
          >
            {tplList.map(t => (
              <option key={t.id} value={t.id}>{t.name || '未命名模板'}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          <span>名称</span>
          <input
            className="border rounded px-2 py-1"
            value={template.name}
            onChange={(e) => setTemplate({ ...template, name: e.target.value })}
            placeholder="模板名称"
          />
        </label>
        <div className="flex items-center gap-2">
          <button className="px-2 py-1 border rounded" onClick={onCreateNew}>新建模板</button>
          <button className="px-2 py-1 border rounded" onClick={onDuplicate}>复制为新模板</button>
          <button className="px-2 py-1 border rounded text-red-600" onClick={onDeleteCurrent}>删除模板</button>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <label className="text-sm text-gray-700 flex flex-col gap-1">
          起点（HH:mm）
          <input
            className="border rounded px-2 py-1"
            value={template.wakeStart}
            onChange={(e) => onWakeStartChange(e.target.value)}
          />
        </label>
        <div className="text-sm text-gray-700 flex flex-col gap-1">
          总时长（小时）
          <div className="flex items-center gap-2">
            <input
              type="number"
              className="border rounded px-2 py-1"
              value={template.totalHours === 0 ? '' : String(template.totalHours)}
              onChange={(e) => setTemplate({ ...template, totalHours: Number(e.target.value || 0) })}
            />
            <button
              className="px-2 py-1 border rounded"
              title="-15 分钟"
              onClick={() => {
                const next = Math.max(0, Math.min(24, (template.totalHours || 0) - 0.25));
                setTemplate({ ...template, totalHours: Number(next.toFixed(2)) });
              }}
            >-15</button>
            <button
              className="px-2 py-1 border rounded"
              title="+15 分钟"
              onClick={() => {
                const next = Math.max(0, Math.min(24, (template.totalHours || 0) + 0.25));
                setTemplate({ ...template, totalHours: Number(next.toFixed(2)) });
              }}
            >+15</button>
          </div>
        </div>
        <div className="text-sm text-gray-700 flex flex-col gap-1">
          结束（HH:mm）
          <div className="flex items-center gap-2">
            <input
              className="border rounded px-2 py-1 w-28 text-center"
              value={endEditing ? endEdit : endHm}
              onFocus={() => { setEndEditing(true); setEndEdit(endHm); }}
              onChange={(e) => {
                const v = e.target.value;
                setEndEdit(v);
                if (/^\d{1,2}:\d{2}$/.test(v)) onEndChange(v);
              }}
              onBlur={() => { setEndEditing(false); setEndEdit(''); }}
              placeholder={endHm}
            />
            {(() => {
              const start = hmToMin(template.wakeStart || '00:00');
              const crossDay = (start + Math.max(0, template.totalHours || 0) * 60) >= 1440;
              return crossDay ? <span className="text-xs text-amber-700">跨日</span> : null;
            })()}
            <button
              className="px-2 py-1 border rounded"
              onClick={() => {
                const v = endEditing ? endEdit : endHm;
                onEndChange((/^\d{1,2}:\d{2}$/.test(v) ? v : endHm));
              }}
            >按结束回填</button>
            <button className="px-2 py-1 border rounded" onClick={fillFromContent}>按内容回填</button>
          </div>
        </div>
        <div className="text-sm text-gray-700 flex items-end">合计期望分钟：{totalDesired} min</div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full border text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="border px-2 py-1 text-left w-10">拖</th>
              <th className="border px-2 py-1 text-left">序</th>
              <th className="border px-2 py-1 text-left">标题</th>
              <th className="border px-2 py-1">期望（min）</th>
              <th className="border px-2 py-1">F / R</th>
              <th className="border px-2 py-1">
                <div className="flex items-center justify-between">
                  <span>操作</span>
                  <div className="space-x-2">
                    <button className="px-2 py-1 border rounded" onClick={() => openPaste(template.slots.length)}>批量粘贴</button>
                    <button className="px-2 py-1 border rounded" onClick={() => openSnippets(template.slots.length)}>片段库</button>
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
            <SortableContext items={template.slots.map(s => s.id)} strategy={verticalListSortingStrategy}>
              <tbody>
                {template.slots.map((s, idx) => (
                  <Row key={s.id} s={s} idx={idx} />
                ))}
              </tbody>
            </SortableContext>
          </DndContext>
        </table>
      </div>

      <div className="flex gap-3">
        <button className="px-3 py-2 rounded bg-black text-white" onClick={addSlot}>新增时段</button>
        <button
          className="px-3 py-2 rounded border"
          onClick={async () => {
            try {
              // 计算 index，并保存到 DB
              const withIndex = {
                ...template,
                slots: template.slots.map((s, i) => ({ ...s, index: i } as any)),
              } as any;
              const saved = await updateTemplate(template.id, withIndex);
              setTemplate(saved);
              saveTemplate(saved); // 兼容本地缓存
              alert('已保存');
            } catch (e) {
              console.error(e);
              alert('保存失败，请查看控制台');
            }
          }}
        >保存</button>
      </div>
      <p className="text-xs text-gray-500">演示版：仅存储在浏览器 localStorage。</p>

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
                    const arr = [...template.slots];
                    const pos = pasteIndex < 0 ? arr.length : Math.min(Math.max(0, pasteIndex), arr.length);
                    arr.splice(pos, 0, ...pasteItems.map(it => ({ ...it })) as any);
                    setTemplate({ ...template, slots: arr });
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

      {snipOpen ? (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-20">
          <div className="bg-white w-[720px] max-w-[95vw] rounded border shadow p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">片段库</h2>
              <button className="px-2 py-1 border rounded" onClick={() => setSnipOpen(false)}>关闭</button>
            </div>
            <div className="grid grid-cols-2 gap-2 max-h-56 overflow-auto">
              {snippets.map((it, i) => (
                <div key={i} className="flex items-center justify-between border rounded px-2 py-1">
                  <div className="text-sm">{it.title} · {it.desiredMin} min {it.rigid ? '· R' : ''}</div>
                  <div className="space-x-2">
                    <button className="px-2 py-1 border rounded" onClick={() => insertSnippet(it)}>插入</button>
                    <button className="px-2 py-1 border rounded text-red-600" onClick={async () => {
                      try {
                        if ((it as any).id) await deleteSnippet((it as any).id);
                        setSnippets(snippets.filter((_, j) => j !== i));
                      } catch {
                        const arr = snippets.slice(); arr.splice(i,1); setSnippets(arr); saveSnippetLibrary(arr);
                      }
                    }}>删除</button>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t pt-3 space-y-2">
              <div className="text-sm font-medium">新增片段</div>
              <div className="grid grid-cols-4 gap-2 items-center text-sm">
                <input className="border rounded px-2 py-1 col-span-2" placeholder="标题" value={snipTitle} onChange={(e) => setSnipTitle(e.target.value)} />
                <input className="border rounded px-2 py-1" placeholder="分钟" value={snipMin} onChange={(e) => setSnipMin(e.target.value)} />
                <label className="inline-flex items-center gap-1"><input type="checkbox" checked={snipRigid} onChange={(e) => setSnipRigid(e.target.checked)} /> <span>R</span></label>
              </div>
              <div className="text-right">
                <button className="px-3 py-1 border rounded" onClick={async () => {
                  const m = Math.max(0, parseInt(snipMin || '0', 10) || 0);
                  if (!snipTitle) return;
                  try {
                    const created = await createSnippet({ title: snipTitle, desiredMin: m, rigid: snipRigid });
                    setSnippets([...snippets, created as any]);
                  } catch {
                    const arr = [...snippets, { title: snipTitle, desiredMin: m, rigid: snipRigid }];
                    setSnippets(arr);
                    saveSnippetLibrary(arr);
                  }
                  setSnipTitle(''); setSnipMin('25'); setSnipRigid(false);
                }}>添加到片段库</button>
              </div>
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
                const s = template.slots[splitIndex];
                if (!s) return;
                const half = Math.max(1, Math.floor((s.desiredMin || 0) / 2));
                setSplitValue(String(half));
              }}>平分</button>
            </div>
            <div className="text-right space-x-2">
              <button className="px-3 py-1 border rounded" onClick={() => setSplitOpen(false)}>取消</button>
              <button className="px-3 py-1 rounded bg-black text-white" onClick={doSplit}>确定</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
