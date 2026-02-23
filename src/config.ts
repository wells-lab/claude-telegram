import { config as loadEnv } from 'dotenv';
import { z } from 'zod';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultEnvPath = path.resolve(__dirname, '..', '.env');
const envPath = process.env.CLAUDEGRAM_ENV_PATH || defaultEnvPath;
loadEnv({ path: envPath });

const toBool = (val: string) => val.toLowerCase() === 'true';

const envSchema = z.object({
  TELEGRAM_BOT_TOKEN: z.string().min(1, 'Telegram bot token is required'),
  ALLOWED_USER_IDS: z
    .string()
    .min(1, 'At least one allowed user ID is required')
    .transform((val) => val.split(',').map((id) => parseInt(id.trim(), 10))),
  ALLOWED_GROUP_IDS: z
    .string()
    .default('')
    .transform((val) => val ? val.split(',').map((id) => parseInt(id.trim(), 10)) : []),
  ANTHROPIC_API_KEY: z.string().optional(),
  WORKSPACE_DIR: z.string().default(process.env.HOME || '.'),
  CLAUDE_EXECUTABLE_PATH: z.string().default('claude'),
  CLAUDE_USE_BUNDLED_EXECUTABLE: z
    .string()
    .default('true')
    .transform((val) => val.toLowerCase() === 'true'),
  CLAUDE_SDK_LOG_LEVEL: z.enum(['off', 'basic', 'verbose', 'trace']).default('basic'),
  CLAUDE_SDK_INCLUDE_PARTIAL: z
    .string()
    .default('false')
    .transform((val) => val.toLowerCase() === 'true'),
  CLAUDE_REASONING_SUMMARY: z
    .string()
    .default('true')
    .transform((val) => val.toLowerCase() === 'true'),
  BOT_NAME: z.string().default('Claudegram'),
  BOT_MODE: z.enum(['dev', 'prod']).default('dev'),
  STREAMING_MODE: z.enum(['streaming', 'wait']).default('streaming'),
  STREAMING_DEBOUNCE_MS: z
    .string()
    .default('500')
    .transform((val) => parseInt(val, 10)),
  MAX_MESSAGE_LENGTH: z
    .string()
    .default('4000')
    .transform((val) => parseInt(val, 10)),
  IMAGE_MAX_FILE_SIZE_MB: z
    .string()
    .default('20')
    .transform((val) => parseInt(val, 10)),
  // New config options
  DANGEROUS_MODE: z
    .string()
    .default('false')
    .transform((val) => val.toLowerCase() === 'true'),
  MAX_LOOP_ITERATIONS: z
    .string()
    .default('5')
    .transform((val) => parseInt(val, 10)),
  // Context visibility
  CONTEXT_SHOW_USAGE: z
    .string()
    .default('false')
    .transform((val) => val.toLowerCase() === 'true'),
  CONTEXT_NOTIFY_COMPACTION: z
    .string()
    .default('true')
    .transform((val) => val.toLowerCase() === 'true'),
  // Terminal UI mode
  TERMINAL_UI_DEFAULT: z
    .string()
    .default('true')
    .transform((val) => val.toLowerCase() === 'true'),
  ALLOW_PRIVATE_NETWORK_URLS: z
    .string()
    .default('false')
    .transform((val) => val.toLowerCase() === 'true'),
  // Logging: show SDK hook JSON dumps (PreToolUse, PostToolUse, stderr, etc.)
  // When false (default), verbose mode shows clean operational logs without hook noise.
  // When true, verbose mode includes full hook JSON payloads and stderr output.
  LOG_AGENT_HOOKS: z
    .string()
    .default('false')
    .transform((val) => val.toLowerCase() === 'true'),
  // Cancel behaviour: auto-cancel running query when user sends a new message
  CANCEL_ON_NEW_MESSAGE: z
    .string()
    .default('false')
    .transform((val) => val.toLowerCase() === 'true'),
  // Agent watchdog: detect stuck/unresponsive agent queries
  AGENT_WATCHDOG_ENABLED: z.string().default('true').transform(toBool),
  AGENT_WATCHDOG_WARN_SECONDS: z
    .string()
    .default('30')
    .transform((val) => parseInt(val, 10)),
  AGENT_WATCHDOG_LOG_SECONDS: z
    .string()
    .default('10')
    .transform((val) => parseInt(val, 10)),
  AGENT_QUERY_TIMEOUT_MS: z
    .string()
    .default('0')
    .transform((val) => parseInt(val, 10)), // 0 = disabled
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment configuration:');
  console.error(parsed.error.message);
  process.exit(1);
}

export const config = parsed.data;

export type Config = typeof config;
