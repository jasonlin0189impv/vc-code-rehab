import * as vscode from 'vscode';

export class NotificationManager {
  private notificationCount = 0;
  private lastNotifiedAtTokens = 0;
  private pausedUntil = 0;

  async maybeNotify(
    tokens: number,
    limit: number,
    tokensPerExtra: number,
    onShowStats: () => void
  ): Promise<void> {
    if (Date.now() < this.pausedUntil) {
      return;
    }

    const isFirst = this.notificationCount === 0;
    const tokensSinceLast = tokens - this.lastNotifiedAtTokens;
    if (!isFirst && tokensSinceLast < tokensPerExtra) {
      return;
    }

    this.notificationCount++;
    this.lastNotifiedAtTokens = tokens;

    const over = tokens - limit;
    const message = this.buildMessage(over, this.notificationCount);
    const useModal = this.notificationCount >= 3;

    const selection = await vscode.window.showWarningMessage(
      message,
      { modal: useModal },
      'Show Stats',
      'Pause 1h'
    );

    if (selection === 'Show Stats') {
      onShowStats();
    } else if (selection === 'Pause 1h') {
      this.pause(60 * 60 * 1000);
      vscode.window.showInformationMessage('VC Coding Limitation: Tracking paused for 1 hour.');
    }
  }

  pause(durationMs: number): void {
    this.pausedUntil = Date.now() + durationMs;
  }

  resume(): void {
    this.pausedUntil = 0;
  }

  isPaused(): boolean {
    return Date.now() < this.pausedUntil;
  }

  resetDay(): void {
    this.notificationCount = 0;
    this.lastNotifiedAtTokens = 0;
  }

  private buildMessage(over: number, count: number): string {
    if (count === 1) {
      return `You've reached your manual coding limit for today. Consider using AI assistance!`;
    } else if (count <= 3) {
      return `Still coding manually? You're ${over} tokens over your daily limit.`;
    } else {
      return `⚠️ ${over} tokens over limit. Seriously — let AI write some of this code.`;
    }
  }
}
