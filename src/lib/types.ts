export type TemplateSlot = {
  id: string;
  index?: number;
  title: string;
  desiredMin: number;
  rigid?: boolean;
  fixedStart?: string; // 'HH:mm' 可选（演示未启用）
  tags?: string[];
};

export type ScheduleTemplate = {
  id: string;
  name: string;
  wakeStart: string; // 'HH:mm'
  totalHours: number; // 当天可用小时数
  slots: TemplateSlot[];
};

export type DaySlot = TemplateSlot & {
  optLen: number;
  optStart: number; // 分钟（自日起点）
  actLen: number;
  start: number; // 分钟（自日起点）
  percent: number; // actLen / optLen
  delay: number; // start - optStart (min)
};

export type DaySchedule = {
  wakeStart: string;
  totalHours: number;
  slots: DaySlot[];
  warnings?: string[];
};

export type UiSettings = {
  showCurrentBar: boolean;
  showBottomSummary: boolean;
  showProgress: boolean;
  showConflictCount: boolean;
  showTotalExpected: boolean;
  showCompressionRatio: boolean;
  showHotkeyHint: boolean; // 显示快捷键提示条
  lockEndTime: boolean; // 锁定结束时间：调整起点时保持结束不变
  autoSaveToDb: boolean; // 自动保存到数据库（模板/当日）
};
