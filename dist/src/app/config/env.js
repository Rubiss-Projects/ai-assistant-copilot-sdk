import dotenv from "dotenv";
import { resolve } from "path";
import { homedir } from "os";
export const CONFIG_DIR = process.env.AI_ASSISTANT_CONFIG_DIR
    ? resolve(process.env.AI_ASSISTANT_CONFIG_DIR)
    : resolve(homedir(), ".ai-assistant");
export function env(key, required) {
    const value = process.env[key];
    if (required && !value) {
        throw new Error(`Missing required environment variable: ${key}`);
    }
    return value;
}
const REQUIRED_VARS = {
    bot: ["DISCORD_TOKEN", "DISCORD_APP_ID", "DISCORD_GUILD_ID"],
    worker: [],
    all: ["DISCORD_TOKEN", "DISCORD_APP_ID", "DISCORD_GUILD_ID"],
};
export function loadEnv(processType = "all") {
    dotenv.config({ path: resolve(CONFIG_DIR, ".env") });
    for (const key of REQUIRED_VARS[processType]) {
        env(key, true);
    }
}
