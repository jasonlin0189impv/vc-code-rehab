import * as vscode from 'vscode';

export class DecorationManager {
  private bgType: vscode.TextEditorDecorationType;
  private rulerType: vscode.TextEditorDecorationType;
  private active = false;

  constructor() {
    this.rulerType = vscode.window.createTextEditorDecorationType({
      overviewRulerColor: '#f14c4c',
      overviewRulerLane: vscode.OverviewRulerLane.Full,
    });

    this.bgType = vscode.window.createTextEditorDecorationType({
      isWholeLine: true,
      backgroundColor: 'rgba(241, 76, 76, 0.07)',
    });
  }

  showLimitReached(): void {
    if (this.active) {
      return;
    }
    this.active = true;
    for (const editor of vscode.window.visibleTextEditors) {
      this.applyToEditor(editor);
    }
  }

  clearLimitReached(): void {
    this.active = false;
    for (const editor of vscode.window.visibleTextEditors) {
      editor.setDecorations(this.rulerType, []);
      editor.setDecorations(this.bgType, []);
    }
  }

  applyToEditor(editor: vscode.TextEditor): void {
    if (!this.active) {
      return;
    }
    const lineCount = editor.document.lineCount;
    const fullRange = new vscode.Range(0, 0, lineCount - 1, 0);
    editor.setDecorations(this.rulerType, [fullRange]);
    editor.setDecorations(this.bgType, [fullRange]);
  }

  dispose(): void {
    this.rulerType.dispose();
    this.bgType.dispose();
  }
}
