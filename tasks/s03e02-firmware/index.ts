import type { TaskDefinition } from "@mission/core";

const SYSTEM_PROMPT = `You are a Linux sysadmin debugging firmware on a restricted VM.

## Goal
Run /opt/firmware/cooler/cooler.bin to get an ECCS code, then submit it.

## Plan
1. Run "help" — learn available commands (this is NOT standard Linux).
2. Run the binary — it will tell you what it needs (password, config).
3. Read settings.ini in the cooler directory — understand the config.
4. Check .gitignore — do NOT touch files listed there.
5. Explore the filesystem methodically to find the password (stored in multiple places). Use "ls" to browse directories. The "find" command does NOT work on this VM.
6. Fix settings.ini using the "editline" command (editline <file> <line-number> <content>).
7. Remove any lock files that block execution.
8. Run the binary with the password to get the ECCS code.
9. Call submit_answer with the code.

## CRITICAL Security Rules
- NEVER access /etc, /root, or /proc/ — instant ban + VM reset.
- ALWAYS check for .gitignore in directories before touching files listed there.
- Do NOT use compound commands (cmd1 && cmd2, cmd1 2>/dev/null) — one simple command per call.

## Key Facts
- Available commands are limited (editline for editing, not vi/nano/sed).
- "find" does NOT work — use "ls" to explore directories.
- The password is stored in several places in the system — search broadly.
- Check "history" for clues about previous attempts.
- If things go wrong, "reboot" resets the VM.`;

const RATE_LIMIT_PATTERNS = ["za często", "zwolnij"];
const MIN_DELAY_MS = 1500;
const RATE_LIMIT_DELAY_MS = 6000;
const MAX_RETRIES = 3;
/** Ban code returned by the API when security rules are violated */
const BAN_CODE = -9001;

export default {
	name: "firmware",
	title: "S03E02 — Fix and run ECCS firmware on virtual machine",
	season: 3,
	episode: 2,

	async run(ctx) {
		const { hub, llm, log } = ctx;

		let lastCallTime = 0;

		const shellOnce = async (cmd: string): Promise<{ output: string; rateLimited: boolean; banned: boolean }> => {
			// Throttle: enforce minimum delay between calls
			const now = Date.now();
			const elapsed = now - lastCallTime;
			if (elapsed < MIN_DELAY_MS) {
				await new Promise((r) => setTimeout(r, MIN_DELAY_MS - elapsed));
			}
			lastCallTime = Date.now();

			const raw = await hub.post("api/shell", { cmd });
			const result = raw as Record<string, unknown>;
			const code = typeof result.code === "number" ? result.code : 0;

			// Build output: message + data
			const parts: string[] = [];
			if (typeof result.message === "string") parts.push(result.message);
			if (result.data !== undefined) {
				if (Array.isArray(result.data)) {
					parts.push(result.data.join("\n"));
				} else if (typeof result.data === "string") {
					parts.push(result.data);
				} else {
					parts.push(JSON.stringify(result.data));
				}
			}
			if (typeof result.stdout === "string" && result.stdout) parts.push(result.stdout);
			if (typeof result.stderr === "string" && result.stderr) parts.push(result.stderr);
			if (typeof result.error === "string" && result.error) parts.push(result.error);
			const output = parts.join("\n").trim() || "(no output)";

			// Detect rate limit by code (-9999) or message content
			const lower = output.toLowerCase();
			const rateLimited = code === -9999 || RATE_LIMIT_PATTERNS.some((p) => lower.includes(p));

			// Detect ban by specific API code (not text matching — "blocked" appears in filenames)
			const banned = code === BAN_CODE;

			return { output, rateLimited, banned };
		};

		/** Execute shell command with auto-retry on rate limit / ban. Agent never sees throttle errors. */
		const shell = async (cmd: string): Promise<string> => {
			log.detail(`Shell> ${cmd}`);

			for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
				try {
					const { output, rateLimited, banned } = await shellOnce(cmd);

					if (rateLimited) {
						log.warn(`Rate limited (attempt ${attempt + 1}/${MAX_RETRIES}) — waiting ${RATE_LIMIT_DELAY_MS / 1000}s`);
						await new Promise((r) => setTimeout(r, RATE_LIMIT_DELAY_MS));
						continue;
					}

					if (banned) {
						log.warn(`Banned (attempt ${attempt + 1}/${MAX_RETRIES}) — waiting 15s`);
						await new Promise((r) => setTimeout(r, 15000));
						continue;
					}

					log.detail(`Result: ${output.slice(0, 300)}${output.length > 300 ? "..." : ""}`);
					return output;
				} catch (err) {
					const msg = err instanceof Error ? err.message : String(err);
					log.warn(`Shell error: ${msg}`);
					return `ERROR: ${msg}`;
				}
			}

			return "ERROR: Command failed after multiple retries due to rate limiting. Try a different approach or use 'reboot' to reset.";
		};

		// --- Agent tools ---
		const tools = [
			{
				name: "shell",
				description:
					"Execute a command on the virtual machine. Returns command output. NEVER access /etc, /root, or /proc/. Use one simple command per call (no && or pipes).",
				parameters: {
					type: "object" as const,
					properties: {
						cmd: {
							type: "string",
							description: "The shell command to execute (single command, no &&)",
						},
					},
					required: ["cmd"],
				},
				async execute(args: unknown) {
					const { cmd } = args as { cmd: string };
					return shell(cmd);
				},
			},
			{
				name: "submit_answer",
				description:
					"Submit the ECCS confirmation code to complete the task. Use when you have obtained the code in format ECCS-xxxx...",
				parameters: {
					type: "object" as const,
					properties: {
						confirmation: {
							type: "string",
							description: "The ECCS code (format: ECCS-xxxxxxxx...)",
						},
					},
					required: ["confirmation"],
				},
				async execute(args: unknown) {
					const { confirmation } = args as { confirmation: string };
					log.send(`Submitting code: ${confirmation}`);
					const result = await hub.verify("firmware", { confirmation });
					log.flag(result);
					return JSON.stringify(result);
				},
			},
		];

		// --- Run agent ---
		log.step("Starting firmware agent");

		const result = await llm.chat({
			model: "anthropic/claude-sonnet-4.6",
			system: SYSTEM_PROMPT,
			messages: [
				{
					role: "user",
					content:
						'Fix the ECCS firmware on the virtual machine. Start by running "help" to see available commands, then work step by step to run /opt/firmware/cooler/cooler.bin and get the ECCS code.',
				},
			],
			tools,
			maxIterations: 30,
		});

		log.success(`Agent finished. Tokens: ${result.usage.totalTokens}, Cost: $${result.usage.cost.toFixed(4)}`);
		if (result.content) {
			log.info(result.content);
		}
	},
} satisfies TaskDefinition;
