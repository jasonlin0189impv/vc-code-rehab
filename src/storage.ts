import * as vscode from 'vscode';
import { DailyRecord } from './types';

const MAX_HISTORY_DAYS = 30;

function todayKey(): string {
  return new Date().toLocaleDateString('en-CA');
}

function recordKey(date: string): string {
  return `vcCL_record_${date}`;
}

function emptyRecord(date: string): DailyRecord {
  return { date, manualTokens: 0, aiTokens: 0 };
}

export class Storage {
  constructor(private ctx: vscode.ExtensionContext) {}

  getTodayRecord(): DailyRecord {
    const date = todayKey();
    const stored = this.ctx.workspaceState.get<DailyRecord>(recordKey(date));
    if (stored && stored.date === date) {
      // Backfill aiTokens for records created before this field existed
      return { ...stored, aiTokens: stored.aiTokens ?? 0 };
    }
    return emptyRecord(date);
  }

  async addTokens(manualCount: number, aiCount: number): Promise<DailyRecord> {
    const record = this.getTodayRecord();
    record.manualTokens += manualCount;
    record.aiTokens += aiCount;
    await this.ctx.workspaceState.update(recordKey(record.date), record);
    return record;
  }

  async markLimitReached(): Promise<void> {
    const record = this.getTodayRecord();
    if (!record.limitReachedAt) {
      record.limitReachedAt = Date.now();
      await this.ctx.workspaceState.update(recordKey(record.date), record);
    }
  }

  async resetToday(): Promise<void> {
    const date = todayKey();
    await this.ctx.workspaceState.update(recordKey(date), emptyRecord(date));
  }

  getHistory(days: number = MAX_HISTORY_DAYS): DailyRecord[] {
    const records: DailyRecord[] = [];
    const today = new Date();
    for (let i = 0; i < days; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const date = d.toLocaleDateString('en-CA');
      const stored = this.ctx.workspaceState.get<DailyRecord>(recordKey(date));
      records.unshift(stored ? { ...stored, aiTokens: stored.aiTokens ?? 0 } : emptyRecord(date));
    }
    return records;
  }
}
