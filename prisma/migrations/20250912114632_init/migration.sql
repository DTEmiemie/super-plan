-- CreateTable
CREATE TABLE "Template" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "wakeStart" TEXT NOT NULL,
    "totalHours" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "TemplateSlot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "desiredMin" INTEGER NOT NULL,
    "rigid" BOOLEAN NOT NULL DEFAULT false,
    "fixedStart" TEXT,
    "tags" TEXT,
    CONSTRAINT "TemplateSlot_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Schedule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateId" TEXT,
    "name" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "wakeStart" TEXT NOT NULL,
    "totalHours" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ScheduleSlot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scheduleId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "desiredMin" INTEGER NOT NULL,
    "rigid" BOOLEAN NOT NULL DEFAULT false,
    "fixedStart" TEXT,
    "optLen" INTEGER NOT NULL,
    "optStart" INTEGER NOT NULL,
    "actLen" INTEGER NOT NULL,
    "start" INTEGER NOT NULL,
    CONSTRAINT "ScheduleSlot_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "Schedule" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RunEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scheduleId" TEXT NOT NULL,
    "scheduleSlotId" TEXT,
    "action" TEXT NOT NULL,
    "at" DATETIME NOT NULL,
    "payload" TEXT,
    CONSTRAINT "RunEvent_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "Schedule" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "TemplateSlot_templateId_index_idx" ON "TemplateSlot"("templateId", "index");

-- CreateIndex
CREATE UNIQUE INDEX "Schedule_date_key" ON "Schedule"("date");

-- CreateIndex
CREATE INDEX "ScheduleSlot_scheduleId_index_idx" ON "ScheduleSlot"("scheduleId", "index");

-- CreateIndex
CREATE INDEX "RunEvent_scheduleId_at_idx" ON "RunEvent"("scheduleId", "at");
