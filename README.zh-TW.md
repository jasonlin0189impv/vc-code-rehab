# Code Rehab

*Read this in [English](README.md)*

> **別再敲鍵盤了。讓 AI 來吧。** 🤖

這是一款追蹤您「手動」輸入多少程式碼的 VSCode 擴充套件，一旦您達到每日上限，它就會不厭其煩地提醒您。

因為如果您在 2026 年還在手寫程式碼，那您需要被提醒。

---

## 功能特色

- **每日手動輸入 Token 追蹤** — 計算您手動輸入的每個字元（AI 自動完成不計算在內）
- **智慧 AI 偵測** — 來自 Copilot、Cursor、Claude Code 等大量的插入內容將被獨立追蹤，並估算為 AI Token
- **背景 AI 追蹤** — 即使檔案未開啟，外部背景檔案的變更（由 AI 代理程式執行）也會被自動捕捉並計算為 AI Token
- **可配置的上限制（絕對值/相對值）** — 設定每日固定的上限，或是根據您的工作區大小設定相對上限（例如總 Token 數的 1%）
- **升級的通知警告** — 友善提醒 → 被動攻擊型的提醒 → 阻擋畫面的強制彈出視窗
- **狀態列顯示** — 隨時可見的即時 Token 計數，超標時會變為紅色
- **統計圖表檢視** — 包含 14 天長條圖、連續達標天數、AI 佔比等多項數據
- **暫停追蹤** — 需要手動重構嗎？您可以暫停 1 小時，且不會中斷您的連續天數紀錄

---

## 運作原理

您的每一次按鍵都會被分析。較小的插入內容（≤ 5 個字元）會被計算為 **手動 Token**。較大的插入內容則歸因於 AI。一旦您達到每日手動 Token 上限：

1. 彈出警告通知，提供「顯示統計 (Show Stats)」或「暫停 1 小時 (Pause 1h)」的選項
2. 之後每增加 50 個 Token，就會觸發另一次通知（語氣會越來越急迫）
3. 在第 3 次通知後，會出現一個 **強制對話框** — 您必須關閉它才能繼續打字
4. 編輯器背景會變成紅色，提醒您注意自己的行為

---

## 統計圖表檢視

點擊狀態列項目或執行 **Code Rehab: Show Token Stats** 來開啟統計面板。

<img src="https://raw.githubusercontent.com/jasonlin0189impv/vc-code-rehab/main/images/stats-preview.png" width="600" alt="預覽統計圖表"/>

面板會顯示：

| 指標 | 說明 |
|--------|-------------|
| 🗓️ 目前連續天數 | 保持在手動上限內的連續天數 |
| 🏆 最佳連續天數 | 您歷史最佳的紀錄 |
| 7天平均 AI 比例 | 本週您的程式碼有多少是 AI 協助完成的 |
| 超標天數 (30天) | 過去一個月的超標檢討 |
| 14 天長條圖 | 每日手動與 AI Token 的比較 |

---

## 設定選項

開啟 **設定 (Settings)** (`Cmd+,`) 並搜尋 `vcCodeRehab`：

| 設定項目 | 預設值 | 說明 |
|---------|---------|-------------|
| `limitMode` | `absolute` | 使用固定的 `absolute` (絕對) 上限，或依據工作區大小的 `relative` (相對) 上限 |
| `relativeLimitPercentage` | `1.0` | 作為上限的工作區總 Token 百分比（若模式為 `relative`） |
| `relativeLimitInclude` | `["**/*"]` | 包含在相對 Token 計數中的檔案 Glob 模式 |
| `relativeLimitExclude` | `[...]` | 相對 Token 計數中要略過的檔案 Glob 模式（如 `node_modules`、`.git`） |
| `dailyTokenLimit` | `1000` | 開始警告前的每日手動 Token 上限（若模式為 `absolute`） |
| `tokensPerExtraNotification` | `50` | 超過上限後，觸發下一次警告所需的 Token 數 |
| `manualTypingMaxChunkSize` | `5` | 大於此數值的插入內容將被視為 AI/貼上 |
| `showStatusBar` | `true` | 顯示/隱藏狀態列項目 |

---

## 指令列表

開啟命令面板 (`Cmd+Shift+P`) 並搜尋 **Code Rehab**：

- **Show Token Stats** — 開啟統計面板
- **Reset Today's Count** — 清除今天的 Token 計數
- **Pause Tracking (1 hour)** — 暫停追蹤 60 分鐘
- **Resume Tracking** — 暫停後立即恢復追蹤
- **Recalculate Workspace Tokens** — 強制重新計算工作區大小（在 Relative 模式下很有用）

---

## 常見問題 (FAQ)

**它能準確追蹤 AI 產生的程式碼嗎？**

沒辦法 — 而且套件中也說明了這一點。此擴充套件使用了一種啟發式方法：大於 5 個字元的插入內容會被「估算」為 AI Token。這能可靠地捕捉到 Copilot、Cursor AI、Claude Code 以及大部分的自動完成，但也會包含手動貼上的內容。這就是為什麼該數字標示為「估算 (estimated)」的原因。

**它能在 Cursor 中運作嗎？**

可以。Cursor 是 VSCode 的分支 (fork)，能原生執行 VSCode 擴充套件。

**我的資料會離開我的電腦嗎？**

永遠不會。所有的 Token 計數都儲存於本地 VSCode 的 workspace state 中。

**為什麼重新載入後計數會重置？**

Token 計數在重新載入後會保留。只有紅色的背景裝飾會重置 — 當您在目前的 session 中再次達到上限時，它才會重新出現。這是刻意設計的，以免重新載入 VSCode 時立刻阻擋您的畫面。

---

## 授權條款

MIT — 請參閱 [LICENSE](LICENSE)
