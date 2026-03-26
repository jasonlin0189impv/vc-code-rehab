import * as vscode from 'vscode';
import { getConfig } from './config';
import { ChangeDetector } from './changeDetector';
import { charsToTokens } from './tokenCounter';
import { Storage } from './storage';
import { StatusBarManager } from './statusBar';
import { NotificationManager } from './notificationManager';
import { DecorationManager } from './decorationManager';
import { showStatsView } from './statsView';
import { countWorkspaceTokens } from './workspaceCounter';

function isSettingsFile(document: vscode.TextDocument): boolean {
  // User settings (vscode-userdata scheme) or workspace .vscode/settings.json
  return document.uri.scheme === 'vscode-userdata' ||
    document.uri.fsPath.replace(/\\/g, '/').includes('/.vscode/settings.json');
}

export function activate(context: vscode.ExtensionContext): void {
  let config = getConfig();
  let effectiveDailyLimit = config.dailyTokenLimit;
  let isRecalculating = false;
  let fileSizes = new Map<string, number>();
  let isReadOnly = false;
  let isReverting = false;
  const documentSnapshots = new Map<string, string>();

  // Initialize snapshots for already-open documents
  for (const doc of vscode.workspace.textDocuments) {
    documentSnapshots.set(doc.uri.toString(), doc.getText());
  }
  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument((doc) => {
      documentSnapshots.set(doc.uri.toString(), doc.getText());
    })
  );
  context.subscriptions.push(
    vscode.workspace.onDidCloseTextDocument((doc) => {
      documentSnapshots.delete(doc.uri.toString());
    })
  );

  const storage = new Storage(context);
  const detector = new ChangeDetector(config.manualTypingMaxChunkSize);
  const notifier = new NotificationManager();
  const decorator = new DecorationManager();
  context.subscriptions.push({ dispose: () => decorator.dispose() });

  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  const statusBar = new StatusBarManager(statusBarItem);
  context.subscriptions.push(statusBarItem);

  const showStats = () =>
    showStatsView(storage.getHistory(), effectiveDailyLimit, config.limitMode, config.relativeLimitPercentage);

  async function updateEffectiveLimit() {
    if (config.limitMode === 'absolute') {
      effectiveDailyLimit = config.dailyTokenLimit;
    } else {
      if (isRecalculating) return;
      isRecalculating = true;
      try {
        const result = await countWorkspaceTokens(config.relativeLimitInclude, config.relativeLimitExclude);
        effectiveDailyLimit = Math.max(1, Math.round(result.totalTokens * (config.relativeLimitPercentage / 100)));
        fileSizes = result.sizeMap;
      } catch (e) {
        effectiveDailyLimit = config.dailyTokenLimit;
      } finally {
        isRecalculating = false;
      }
    }

    // Refresh UI
    const record = storage.getTodayRecord();
    if (config.showStatusBar) {
      statusBar.update(record, effectiveDailyLimit, config.limitMode, config.relativeLimitPercentage);
    }
  }

  // Initialize UI with calculated limits asynchronously
  updateEffectiveLimit();
  // Decoration is NOT restored on startup — only triggered by new typing this session.

  // --- Hot path: track every text document change ---
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(async (event) => {
      if (isReverting) return;

      const docKey = event.document.uri.toString();

      // Read-only mode: revert any fresh edits in non-settings files
      if (isReadOnly && !isSettingsFile(event.document)) {
        if (event.reason === undefined && event.contentChanges.length > 0) {
          const snapshot = documentSnapshots.get(docKey);
          const editor = vscode.window.visibleTextEditors.find(e => e.document === event.document);
          if (snapshot !== undefined && editor) {
            const savedSelections = editor.selections;
            isReverting = true;
            try {
              await editor.edit((editBuilder) => {
                const fullRange = new vscode.Range(
                  new vscode.Position(0, 0),
                  event.document.positionAt(event.document.getText().length)
                );
                editBuilder.replace(fullRange, snapshot);
              }, { undoStopBefore: false, undoStopAfter: false });
              editor.selections = savedSelections;
            } finally {
              isReverting = false;
            }
          }
        } else {
          // Undo/redo while in read-only mode — keep snapshot in sync
          documentSnapshots.set(docKey, event.document.getText());
        }
        return;
      }

      documentSnapshots.set(docKey, event.document.getText());

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
        statusBar.update(record, effectiveDailyLimit, config.limitMode, config.relativeLimitPercentage);
      }

      if (record.manualTokens >= effectiveDailyLimit) {
        await storage.markLimitReached();
        decorator.showLimitReached();
        await notifier.maybeNotify(record.manualTokens, effectiveDailyLimit, config.tokensPerExtraNotification, showStats);
      }
    })
  );

  // --- Background tracking: catch external file modifications (AI generated on disk) ---
  const watcher = vscode.workspace.createFileSystemWatcher('**/*');
  context.subscriptions.push(watcher);

  const handleFsChange = async (uri: vscode.Uri, isCreate: boolean) => {
    // If it's merely a change (not a create) and the file is open, VS Code tracks it natively via onDidChangeTextDocument.
    if (!isCreate && vscode.workspace.textDocuments.some(doc => doc.uri.toString() === uri.toString())) {
      return;
    }

    const path = uri.fsPath.toLowerCase();
    if (path.includes('node_modules') || path.includes('.git') || path.includes('dist/') || path.includes('out/')) {
      return;
    }

    try {
      const stat = await vscode.workspace.fs.stat(uri);
      const newSize = stat.size;

      let diffBytes = 0;
      if (isCreate) {
        diffBytes = newSize;
      } else {
        if (fileSizes.has(uri.toString())) {
          const oldSize = fileSizes.get(uri.toString())!;
          diffBytes = newSize - oldSize;
        } else {
          // If we don't have the old size (e.g., Absolute Mode where cache isn't pre-filled),
          // we set the baseline without adding incorrect huge diffs.
          diffBytes = 0;
        }
      }

      fileSizes.set(uri.toString(), newSize);

      if (diffBytes > 0) {
        // Convert byte size difference to estimated tokens and count as AI
        const addedAiTokens = charsToTokens(diffBytes);
        const record = await storage.addTokens(0, addedAiTokens);

        if (config.showStatusBar) {
          statusBar.update(record, effectiveDailyLimit, config.limitMode, config.relativeLimitPercentage);
        }
      }
    } catch (e) {
      // Ignore
    }
  };

  watcher.onDidChange((uri) => handleFsChange(uri, false));
  watcher.onDidCreate((uri) => handleFsChange(uri, true));
  watcher.onDidDelete((uri) => {
    fileSizes.delete(uri.toString());
  });

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
      if (e.affectsConfiguration('vcCodeRehab')) {
        config = getConfig();
        detector.updateChunkSize(config.manualTypingMaxChunkSize);

        if (!config.showStatusBar) {
          statusBar.hide();
        }
        updateEffectiveLimit(); // will also refresh status bar
      }
    })
  );

  // --- Commands ---
  context.subscriptions.push(
    vscode.commands.registerCommand('vcCodeRehab.showStats', showStats)
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('vcCodeRehab.resetToday', async () => {
      await storage.resetToday();
      notifier.resetDay();
      decorator.clearLimitReached();
      const record = storage.getTodayRecord();
      if (config.showStatusBar) {
        statusBar.update(record, effectiveDailyLimit, config.limitMode, config.relativeLimitPercentage);
      }
      vscode.window.showInformationMessage("Code Rehab: Today's token count has been reset.");
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('vcCodeRehab.pauseTracking', () => {
      notifier.pause(60 * 60 * 1000);
      decorator.clearLimitReached();
      vscode.window.showInformationMessage('Code Rehab: Tracking paused for 1 hour.');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('vcCodeRehab.resumeTracking', () => {
      notifier.resume();
      const record = storage.getTodayRecord();
      if (record.manualTokens >= effectiveDailyLimit) {
        decorator.showLimitReached();
      }
      vscode.window.showInformationMessage('Code Rehab: Tracking resumed.');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('vcCodeRehab.recalculateWorkspace', async () => {
      if (config.limitMode !== 'relative') {
        vscode.window.showInformationMessage('Code Rehab: Currently in Absolute limit mode. Switch to Relative mode to recalculate.');
        return;
      }
      vscode.window.showInformationMessage('Code Rehab: Recalculating workspace tokens...');
      await updateEffectiveLimit();
      vscode.window.showInformationMessage(`Code Rehab: Finished recalculating. New daily limit is ${effectiveDailyLimit}.`);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('vcCodeRehab.enableReadOnly', () => {
      isReadOnly = true;
      statusBar.showReadOnly();
      vscode.window.showInformationMessage('Code Rehab: Read-only mode enabled. Typing is blocked (settings files still editable).');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('vcCodeRehab.disableReadOnly', () => {
      isReadOnly = false;
      const record = storage.getTodayRecord();
      if (config.showStatusBar) {
        statusBar.update(record, effectiveDailyLimit, config.limitMode, config.relativeLimitPercentage);
      } else {
        statusBar.hide();
      }
      vscode.window.showInformationMessage('Code Rehab: Read-only mode disabled.');
    })
  );
}

export function deactivate(): void { }
