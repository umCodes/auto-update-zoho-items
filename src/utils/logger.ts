const COLORS = {
  reset: "\x1b[0m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  magenta: "\x1b[35m",
} as const;

export function createLogger(scope: string) {
  const prefix = `[${scope}]`;

  return {
    info: (message: string, ...args: unknown[]) => {
      console.log(`${COLORS.cyan}${prefix}${COLORS.reset} ${message}`, ...args);
    },
    success: (message: string, ...args: unknown[]) => {
      console.log(`${COLORS.green}${prefix}${COLORS.reset} ${message}`, ...args);
    },
    warn: (message: string, ...args: unknown[]) => {
      console.warn(`${COLORS.yellow}${prefix}${COLORS.reset} ${message}`, ...args);
    },
    error: (message: string, ...args: unknown[]) => {
      console.error(`${COLORS.red}${prefix}${COLORS.reset} ${message}`, ...args);
    },
    debug: (message: string, ...args: unknown[]) => {
      console.log(`${COLORS.magenta}${prefix}${COLORS.reset} ${message}`, ...args);
    },
  };
}
