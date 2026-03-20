import * as vscode from 'vscode';
import { getConfig } from './config';
import { ChangeDetector } from './changeDetector';
import { charsToTokens } from './tokenCounter';
import { Storage } from './storage';
import { StatusBarManager } from './statusBar';
import { NotificationManager } from './notificationManager';
import { DecorationManager } from './decorationManager';
import { showStatsView } from './statsView';

export function activate(context: vscode.ExtensionContext): void {
  let config = getConfig();

  const storage = new Storage(context);
  const detector = new ChangeDetector(config.manualTypingMaxChunkSize);
  const notifier = new NotificationManager();
  const decorator = new DecorationManager();
  context.subscriptions.push({ dispose: () => decorator.dispose() });

  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  const statusBar = new StatusBarManager(statusBarItem);
  context.subscriptions.push(statusBarItem);

  const showStats = () =>
    showStatsView(storage.getHistory(), config.dailyTokenLimit);

  // Initialize UI with today's data
  const initial = storage.getTodayRecord();
  if (config.showStatusBar) {
    statusBar.update(initial, config.dailyTokenLimit);
  }
  // Decoration is NOT restored on startup — only triggered by new typing this session.

  // --- Hot path: track every text document change ---
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(async (event) => {
      if (notifier.isPaused()) {
        return;
      }

      const { manualChars, aiChars } = detector.classify(event);
      if (manualChars === 0 && aiChars === 0) {
        return;
      }

      const manualTokens = charsToTokens(manualChars);
      const aiTokens = charsToTokens(aiChars);
      const record = await storage.addTokens(manualTokens, aiTokens);

      if (config.showStatusBar) {
        statusBar.update(record, config.dailyTokenLimit);
      }

      if (record.manualTokens >= config.dailyTokenLimit) {
        await storage.markLimitReached();
        decorator.showLimitReached();
        await notifier.maybeNotify(record.manualTokens, config.dailyTokenLimit, config.tokensPerExtraNotification, showStats);
      }
    })
  );

  // Apply decorations when switching to a different editor tab
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor) {
        decorator.applyToEditor(editor);
      }
    })
  );

  // --- Live config reload ---
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('vcCodingLimitation')) {
        config = getConfig();
        detector.updateChunkSize(config.manualTypingMaxChunkSize);

        const record = storage.getTodayRecord();
        if (config.showStatusBar) {
          statusBar.update(record, config.dailyTokenLimit);
        } else {
          statusBar.hide();
        }
      }
    })
  );

  // --- Commands ---
  context.subscriptions.push(
    vscode.commands.registerCommand('vcCodingLimitation.showStats', showStats)
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('vcCodingLimitation.resetToday', async () => {
      await storage.resetToday();
      notifier.resetDay();
      decorator.clearLimitReached();
      const record = storage.getTodayRecord();
      if (config.showStatusBar) {
        statusBar.update(record, config.dailyTokenLimit);
      }
      vscode.window.showInformationMessage("VC Coding Limitation: Today's token count has been reset.");
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('vcCodingLimitation.pauseTracking', () => {
      notifier.pause(60 * 60 * 1000);
      decorator.clearLimitReached();
      vscode.window.showInformationMessage('VC Coding Limitation: Tracking paused for 1 hour.');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('vcCodingLimitation.resumeTracking', () => {
      notifier.resume();
      const record = storage.getTodayRecord();
      if (record.manualTokens >= config.dailyTokenLimit) {
        decorator.showLimitReached();
      }
      vscode.window.showInformationMessage('VC Coding Limitation: Tracking resumed.');
    })
  );
}

export function deactivate(): void {}
