import * as vscode from 'vscode';
import { ExtensionConfig } from './types';

const SECTION = 'vcCodeRehab';

export function getConfig(): ExtensionConfig {
  const cfg = vscode.workspace.getConfiguration(SECTION);
  return {
    dailyTokenLimit: Math.max(1, cfg.get<number>('dailyTokenLimit', 1000)),
    tokensPerExtraNotification: Math.max(1, cfg.get<number>('tokensPerExtraNotification', 50)),
    manualTypingMaxChunkSize: Math.max(1, cfg.get<number>('manualTypingMaxChunkSize', 5)),
    showStatusBar: cfg.get<boolean>('showStatusBar', true),
  };
}
