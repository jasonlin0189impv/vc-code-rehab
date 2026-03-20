import * as vscode from 'vscode';

const RING_BUFFER_SIZE = 20;
const PASTE_BURST_WINDOW_MS = 500;
const PASTE_BURST_THRESHOLD = 20; // changes within the window = paste

export class ChangeDetector {
  private recentChangeTimes: number[] = [];
  private maxChunkSize: number;

  constructor(maxChunkSize: number) {
    this.maxChunkSize = maxChunkSize;
  }

  updateChunkSize(maxChunkSize: number): void {
    this.maxChunkSize = maxChunkSize;
  }

  /**
   * Classifies all content changes in a document event.
   * Returns manually-typed chars and estimated AI-generated chars separately.
   * Paste bursts are excluded from both counts.
   */
  classify(event: vscode.TextDocumentChangeEvent): { manualChars: number; aiChars: number } {
    const now = Date.now();
    this.trackTime(now);

    if (this.isPasteBurst(now)) {
      return { manualChars: 0, aiChars: 0 };
    }

    let manualChars = 0;
    let aiChars = 0;
    for (const change of event.contentChanges) {
      if (change.text.length === 0) {
        continue;
      }
      if (change.text.length > this.maxChunkSize) {
        // Large insertion: likely AI completion
        aiChars += change.text.length;
      } else {
        manualChars += change.text.length;
      }
    }
    return { manualChars, aiChars };
  }

  private trackTime(now: number): void {
    this.recentChangeTimes.push(now);
    if (this.recentChangeTimes.length > RING_BUFFER_SIZE) {
      this.recentChangeTimes.shift();
    }
  }

  private isPasteBurst(now: number): boolean {
    if (this.recentChangeTimes.length < PASTE_BURST_THRESHOLD) {
      return false;
    }
    const oldest = this.recentChangeTimes[this.recentChangeTimes.length - PASTE_BURST_THRESHOLD];
    return now - oldest < PASTE_BURST_WINDOW_MS;
  }
}
