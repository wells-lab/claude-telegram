/**
 * MCP Tools — In-process MCP server factory for claude-telegram.
 *
 * Wraps project management functions as MCP tools so Claude can invoke
 * them automatically based on conversation context.
 */

import { z } from 'zod';
import { createSdkMcpServer, tool, type McpSdkServerConfigWithInstance, type SdkMcpToolDefinition } from '@anthropic-ai/claude-agent-sdk';
import * as fs from 'fs';
import * as path from 'path';
import { sessionManager } from './session-manager.js';
import { getWorkspaceRoot, isPathWithinRoot } from '../utils/workspace-guard.js';

// ── Types ────────────────────────────────────────────────────────────

export interface McpToolsContext {
  telegramCtx: import('grammy').Context;
  sessionKey: string;
}

// ── Factory ──────────────────────────────────────────────────────────

export function createClaudegramMcpServer(
  toolsCtx: McpToolsContext
): McpSdkServerConfigWithInstance {
  const tools = buildToolList(toolsCtx);

  return createSdkMcpServer({
    name: 'claudegram-tools',
    version: '1.0.0',
    tools,
  });
}

function buildToolList(toolsCtx: McpToolsContext) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tools: SdkMcpToolDefinition<any>[] = [
    listProjectsTool(toolsCtx),
    switchProjectTool(toolsCtx),
  ];

  return tools;
}

// ── Tool Definitions ─────────────────────────────────────────────────

function listProjectsTool(_toolsCtx: McpToolsContext) {
  return tool(
    'claudegram_list_projects',
    'List all available projects in the workspace directory. Use this to see what projects the user can switch to.',
    {},
    async () => {
      try {
        const workspaceRoot = getWorkspaceRoot();
        const entries = fs.readdirSync(workspaceRoot, { withFileTypes: true });
        const projects = entries
          .filter(e => e.isDirectory() && !e.name.startsWith('.'))
          .map(e => e.name);

        return {
          content: [{
            type: 'text' as const,
            text: `Projects in ${workspaceRoot}:\n${projects.join('\n')}`,
          }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error listing projects: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );
}

function switchProjectTool(toolsCtx: McpToolsContext) {
  return tool(
    'claudegram_switch_project',
    'Switch the working directory to a different project. The change takes effect on the next query. Use claudegram_list_projects first to see available projects.',
    { project_name: z.string().describe('Name of the project directory to switch to') },
    async ({ project_name }) => {
      try {
        const workspaceRoot = getWorkspaceRoot();
        const targetPath = path.resolve(workspaceRoot, project_name);

        if (!isPathWithinRoot(workspaceRoot, targetPath)) {
          return {
            content: [{ type: 'text' as const, text: `Error: Path must be within workspace root: ${workspaceRoot}` }],
            isError: true,
          };
        }

        if (!fs.existsSync(targetPath) || !fs.statSync(targetPath).isDirectory()) {
          return {
            content: [{ type: 'text' as const, text: `Error: Project not found: ${project_name}` }],
            isError: true,
          };
        }

        sessionManager.setWorkingDirectory(toolsCtx.sessionKey, targetPath);

        return {
          content: [{
            type: 'text' as const,
            text: `Switched to project: ${project_name} (${targetPath}). The new working directory will take effect on the next query.`,
          }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error switching project: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );
}
