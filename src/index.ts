// Backward-compatible entrypoint.
// New code should use `ai-assistant start-bot` (→ src/bot/index.ts) directly.
import { startBot } from "./bot/index.js";

await startBot();
