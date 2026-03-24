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
    limitMode: cfg.get<'absolute' | 'relative'>('limitMode', 'absolute'),
    relativeLimitPercentage: cfg.get<number>('relativeLimitPercentage', 1.0),
    relativeLimitInclude: cfg.get<string[]>('relativeLimitInclude', ['**/*']),
    relativeLimitExclude: cfg.get<string[]>('relativeLimitExclude', ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/out/**', '**/.vscode/**']),
  };
}
