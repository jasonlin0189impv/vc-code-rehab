import * as vscode from 'vscode';
import { charsToTokens } from './tokenCounter';

function buildGlob(patterns: string[]): string {
  if (!patterns || patterns.length === 0) {
    return '';
  }
  if (patterns.length === 1) {
    return patterns[0];
  }
  return `{${patterns.join(',')}}`;
}

export interface WorkspaceTokenResult {
  totalTokens: number;
  sizeMap: Map<string, number>;
}

export async function countWorkspaceTokens(include: string[], exclude: string[]): Promise<WorkspaceTokenResult> {
  const includeGlob = buildGlob(include);
  const excludeGlob = buildGlob(exclude);
  const sizeMap = new Map<string, number>();
  
  if (!includeGlob) {
    return { totalTokens: 0, sizeMap };
  }

  // Find files with a generous max limit to avoid freezing the extension host on huge workspaces
  const files = await vscode.workspace.findFiles(includeGlob, excludeGlob, 5000);
  
  let totalChars = 0;
  for (const file of files) {
    try {
      const stat = await vscode.workspace.fs.stat(file);
      totalChars += stat.size;
      sizeMap.set(file.toString(), stat.size);
    } catch (e) {
      // Ignore files that cannot be read
    }
  }

  return { totalTokens: charsToTokens(totalChars), sizeMap };
}
