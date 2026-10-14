import type { SIMServeConfig } from "./SIMServeConfig";
import { REFRESH_INTERVAL_MS } from "./SIMServeConstants";

class ConfigManager {
  private config: SIMServeConfig | null = null;
  private lastRefreshAttemptMs = 0;

  load(config: SIMServeConfig): void {
    this.config = config;
  }

  update(newConfig: SIMServeConfig): void {
    this.config = newConfig;
  }

  markRefreshAttempt(): void {
    this.lastRefreshAttemptMs = Date.now();
  }

  getUrl(): string {
    if (this.config === null) {
      throw new Error("ConfigManager: config not loaded yet");
    }

    return `wss://${this.config.host}:${this.config.port}/ws`;
  }

  shouldRefresh(): boolean {
    if (this.lastRefreshAttemptMs === 0) {
      return true;
    }

    return Date.now() - this.lastRefreshAttemptMs >= REFRESH_INTERVAL_MS;
  }
}

export const configManager = new ConfigManager();
