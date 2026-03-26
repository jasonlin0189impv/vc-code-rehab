import * as vscode from 'vscode';
import { DailyRecord } from './types';

export class StatusBarManager {
  constructor(private item: vscode.StatusBarItem) {
    this.item.command = 'vcCodeRehab.showStats';
  }

  update(record: DailyRecord, limit: number, limitMode: 'absolute' | 'relative' = 'absolute', relativePct: number = 1.0): void {
    const tokens = record.manualTokens;
    const pct = tokens / limit;
    const aiLabel = record.aiTokens > 0 ? `  |  🤖 ${record.aiTokens}` : '';
    const modeInfo = limitMode === 'relative' ? `\n(Relative Mode: ${relativePct}% of workspace tokens)` : '';

    if (pct >= 1) {
      this.item.text = `$(error) LIMIT REACHED (${tokens})${aiLabel}`;
      this.item.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
      this.item.tooltip = `Manual coding limit reached: ${tokens} / ${limit} tokens.${modeInfo}\nEstimated AI tokens today: ${record.aiTokens}.\nClick to view stats.`;
    } else if (pct >= 0.8) {
      this.item.text = `$(warning) ${tokens} / ${limit}${aiLabel}`;
      this.item.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
      this.item.tooltip = `Approaching manual coding limit: ${tokens} / ${limit} tokens.${modeInfo}\nEstimated AI tokens today: ${record.aiTokens}.\nClick to view stats.`;
    } else {
      this.item.text = `$(keyboard) ${tokens} / ${limit}${aiLabel}`;
      this.item.backgroundColor = undefined;
      this.item.tooltip = `Manual tokens today: ${tokens} / ${limit}.${modeInfo}\nEstimated AI tokens today: ${record.aiTokens}.\nClick to view stats.`;
    }

    this.item.show();
  }

  showReadOnly(): void {
    this.item.text = '$(lock) READ-ONLY';
    this.item.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    this.item.tooltip = 'Code Rehab: Read-only mode is active. Typing is blocked.\nClick to disable.';
    this.item.command = 'vcCodeRehab.disableReadOnly';
    this.item.show();
  }

  hide(): void {
    this.item.hide();
  }

  dispose(): void {
    this.item.dispose();
  }
}
