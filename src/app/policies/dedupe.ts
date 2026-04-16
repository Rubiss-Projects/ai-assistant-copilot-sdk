import { getState, setState } from "../store/pluginState.js";

const PLUGIN_NAME = "_dedupe";

export function isDuplicate(sourceId: string, windowMs: number): boolean {
  const key = `seen:${sourceId}`;
  const lastSeen = getState(PLUGIN_NAME, key);
  if (lastSeen) {
    const elapsed = Date.now() - new Date(lastSeen).getTime();
    if (elapsed < windowMs) return true;
  }
  // Record this occurrence
  setState(PLUGIN_NAME, key, new Date().toISOString());
  return false;
}

export function clearExpired(_windowMs: number): number {
  // This would need a bulk query - for now just a placeholder
  // In practice, the session cleanup job handles this
  return 0;
}
