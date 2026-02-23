import { Bot, type Context } from 'grammy';
import { autoRetry } from '@grammyjs/auto-retry';
import { sequentialize } from '@grammyjs/runner';
import { config } from '../config.js';
import { buildSessionKey } from '../utils/session-key.js';
import { authMiddleware } from './middleware/auth.middleware.js';
import {
  handleStart,
  handleClear,
  handleClearCallback,
  handleProject,
  handleNewProject,
  handleProjectCallback,
  handleStatus,
  handleMode,
  handleModeCallback,
  handleBotStatus,
  handleRestartBot,
  handleRestartCallback,
  handleContext,
  handlePing,
  handleCancel,
  handleCommands,
  handleModelCommand,
  handleModelCallback,
  handlePlan,
  handleExplore,
  handleResume,
  handleResumeCallback,
  handleContinue,
  handleLoop,
  handleSessions,
  handleTeleport,
  handleFile,
  handleTerminalUI,
  handleTerminalUICallback,
  handleReset,
  handleResetCallback,
} from './handlers/command.handler.js';
import { handleMessage } from './handlers/message.handler.js';
import { handlePhoto, handleImageDocument } from './handlers/photo.handler.js';

// Resolve sequentialize constraint: same-chat updates are ordered,
// but /cancel is registered BEFORE this middleware so it bypasses it.
function getSequentializeKey(ctx: Context): string | undefined {
  const chatId = ctx.chat?.id;
  if (!chatId) return undefined;
  const msg = (ctx.message ?? ctx.callbackQuery?.message) as
    | { is_topic_message?: boolean; message_thread_id?: number }
    | undefined;
  const threadId = msg?.is_topic_message ? msg.message_thread_id : undefined;
  return buildSessionKey(chatId, threadId);
}

export async function createBot(): Promise<Bot> {
  const bot = new Bot(config.TELEGRAM_BOT_TOKEN, {
    client: {
      timeoutSeconds: 60,
    },
  });

  // Auto-retry on transient network errors
  bot.api.config.use(autoRetry({
    maxRetryAttempts: 5,
    maxDelaySeconds: 60,
    rethrowInternalServerErrors: false,
  }));

  // Register command menu for autocomplete (non-blocking)
  const commandList = [
    { command: 'start', description: 'Show help and getting started' },
    { command: 'project', description: 'Set working directory' },
    { command: 'status', description: 'Show current session status' },
    { command: 'clear', description: 'Clear conversation history' },
    { command: 'cancel', description: 'Cancel current request' },
    { command: 'softreset', description: 'Soft reset (cancel + clear session)' },
    { command: 'resume', description: 'Resume a session' },
    { command: 'continue', description: 'Continue latest session' },
    { command: 'sessions', description: 'View saved sessions' },
    { command: 'plan', description: 'Start planning mode' },
    { command: 'explore', description: 'Explore codebase' },
    { command: 'loop', description: 'Run in loop mode' },
    { command: 'teleport', description: 'Move session to terminal' },
    { command: 'file', description: 'Download a file from project' },
    { command: 'model', description: 'Switch AI model' },
    { command: 'mode', description: 'Toggle streaming mode' },
    { command: 'terminalui', description: 'Toggle terminal-style display' },
    { command: 'context', description: 'Show Claude context usage' },
    { command: 'botstatus', description: 'Show bot process status' },
    { command: 'restartbot', description: 'Restart the bot' },
    { command: 'commands', description: 'List all commands' },
  ];

  bot.api.setMyCommands(commandList).then(() => {
    console.log('Command menu registered');
  }).catch((err) => {
    console.warn('Failed to register commands:', err.message);
  });

  // Apply auth middleware to all updates
  bot.use(authMiddleware);

  // /cancel, /reset, and /ping fire BEFORE sequentialize so they bypass per-chat ordering.
  bot.command('cancel', handleCancel);
  bot.command('softreset', handleReset);
  bot.command('ping', handlePing);

  // Sequentialize: same-chat updates are processed in order.
  bot.use(sequentialize(getSequentializeKey));

  // Bot command handlers (sequentialized per chat)
  bot.command('start', handleStart);
  bot.command('clear', handleClear);
  bot.command('project', handleProject);
  bot.command('newproject', handleNewProject);
  bot.command('status', handleStatus);
  bot.command('mode', handleMode);
  bot.command('terminalui', handleTerminalUI);
  bot.command('botstatus', handleBotStatus);
  bot.command('restartbot', handleRestartBot);
  bot.command('context', handleContext);

  bot.command('commands', handleCommands);
  bot.command('model', handleModelCommand);
  bot.command('plan', handlePlan);
  bot.command('explore', handleExplore);

  // Session resume commands
  bot.command('resume', handleResume);
  bot.command('continue', handleContinue);
  bot.command('sessions', handleSessions);

  // Loop mode
  bot.command('loop', handleLoop);

  // Teleport to terminal
  bot.command('teleport', handleTeleport);

  // File commands
  bot.command('file', handleFile);

  // Callback query handler for inline keyboards
  bot.on('callback_query:data', async (ctx) => {
    const data = ctx.callbackQuery.data;

    if (data.startsWith('resume:')) {
      await handleResumeCallback(ctx);
    } else if (data.startsWith('model:')) {
      await handleModelCallback(ctx);
    } else if (data.startsWith('mode:')) {
      await handleModeCallback(ctx);
    } else if (data.startsWith('terminalui:')) {
      await handleTerminalUICallback(ctx);
    } else if (data.startsWith('clear:')) {
      await handleClearCallback(ctx);
    } else if (data.startsWith('project:')) {
      await handleProjectCallback(ctx);
    } else if (data.startsWith('restart:')) {
      await handleRestartCallback(ctx);
    } else if (data.startsWith('reset:')) {
      await handleResetCallback(ctx);
    }
  });

  // Handle images
  bot.on('message:photo', handlePhoto);

  // Handle documents (image documents)
  bot.on('message:document', async (ctx) => {
    await handleImageDocument(ctx);
  });

  // Handle regular text messages
  bot.on('message:text', handleMessage);

  // Error handler
  bot.catch((err) => {
    console.error('Bot error:', err);
  });

  return bot;
}
