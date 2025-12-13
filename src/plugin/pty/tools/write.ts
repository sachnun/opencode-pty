import { tool } from "@opencode-ai/plugin";
import { manager } from "../manager.ts";
import { checkCommandPermission } from "../permissions.ts";
import DESCRIPTION from "./write.txt";

function extractCommands(data: string): string[] {
  const commands: string[] = [];
  const lines = data.split(/[\n\r]+/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("\x03") && !trimmed.startsWith("\x04")) {
      commands.push(trimmed);
    }
  }
  return commands;
}

function parseCommand(commandLine: string): { command: string; args: string[] } {
  const parts = commandLine.split(/\s+/).filter(Boolean);
  const command = parts[0] ?? "";
  const args = parts.slice(1);
  return { command, args };
}

export const ptyWrite = tool({
  description: DESCRIPTION,
  args: {
    id: tool.schema.string().describe("The PTY session ID (e.g., pty_a1b2c3d4)"),
    data: tool.schema.string().describe("The input data to send to the PTY"),
  },
  async execute(args) {
    const session = manager.get(args.id);
    if (!session) {
      throw new Error(`PTY session '${args.id}' not found. Use pty_list to see active sessions.`);
    }

    if (session.status !== "running") {
      throw new Error(`Cannot write to PTY '${args.id}' - session status is '${session.status}'.`);
    }

    const commands = extractCommands(args.data);
    for (const commandLine of commands) {
      const { command, args: cmdArgs } = parseCommand(commandLine);
      if (command) {
        await checkCommandPermission(command, cmdArgs);
      }
    }

    const success = manager.write(args.id, args.data);
    if (!success) {
      throw new Error(`Failed to write to PTY '${args.id}'.`);
    }

    const preview = args.data.length > 50 ? args.data.slice(0, 50) + "..." : args.data;
    const displayPreview = preview.replace(/\x03/g, "^C").replace(/\x04/g, "^D").replace(/\n/g, "\\n").replace(/\r/g, "\\r");
    return `Sent ${args.data.length} bytes to ${args.id}: "${displayPreview}"`;
  },
});
