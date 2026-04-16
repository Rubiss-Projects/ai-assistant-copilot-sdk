import { getState, setState } from "../store/pluginState.js";

const PLUGIN_NAME = "_policy_engine";

export function recordAction(action: string, service: string): void {
  const key = `cooldown:${action}:${service}`;
  setState(PLUGIN_NAME, key, new Date().toISOString());
}

export function getLastActionTime(
  action: string,
  service: string,
): Date | null {
  const key = `cooldown:${action}:${service}`;
  const value = getState(PLUGIN_NAME, key);
  return value ? new Date(value) : null;
}

export function isInCooldown(
  action: string,
  service: string,
  cooldownMs: number,
): boolean {
  const last = getLastActionTime(action, service);
  if (!last) return false;
  return Date.now() - last.getTime() < cooldownMs;
}
