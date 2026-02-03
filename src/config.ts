import { z } from 'zod';

const LogLevel = z.enum(['debug', 'info', 'warn', 'error']);
export type LogLevel = z.infer<typeof LogLevel>;

const ConfigSchema = z.object({
  appId: z
    .string({ required_error: 'FEISHU_APP_ID is required' })
    .min(1, 'FEISHU_APP_ID must not be empty'),
  appSecret: z
    .string({ required_error: 'FEISHU_APP_SECRET is required' })
    .min(1, 'FEISHU_APP_SECRET must not be empty'),
  targetUserId: z.string().min(1).optional(),
  logLevel: LogLevel.default('info'),
});

export type Config = z.infer<typeof ConfigSchema>;

/**
 * Load configuration from environment variables.
 *
 * Required environment variables:
 *   - FEISHU_APP_ID: Feishu application App ID
 *   - FEISHU_APP_SECRET: Feishu application App Secret
 *
 * Optional environment variables:
 *   - FEISHU_USER_ID: Default target user Open ID
 *   - LOG_LEVEL: Log level (debug | info | warn | error), defaults to "info"
 *
 * @throws {z.ZodError} when required variables are missing or invalid
 */
export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const raw = {
    appId: env.FEISHU_APP_ID,
    appSecret: env.FEISHU_APP_SECRET,
    targetUserId: env.FEISHU_USER_ID || undefined,
    logLevel: env.LOG_LEVEL || undefined,
  };

  return ConfigSchema.parse(raw);
}
