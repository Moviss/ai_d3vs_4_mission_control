import type { HubResponse, Logger, TaskDefinition, TaskStatus } from "@mission/core";
import chalk from "chalk";

const g = chalk.green;
const gb = chalk.greenBright;
const gd = chalk.hex("#00aa00");
const dim = chalk.dim.green;
const hi = chalk.bold.greenBright;
const err = chalk.red;
const wrn = chalk.yellow;

const LINE_W = 52;
const LINE = gd("\u2500".repeat(LINE_W));
const INDENT = "     ";

function elapsed(startTime: number): string {
	const secs = ((performance.now() - startTime) / 1000).toFixed(1);
	return dim(`[${secs}s]`);
}

// biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI escape codes
const ANSI_RE = /\x1b\[[0-9;]*m/g;

function padRight(str: string, width: number): string {
	const visible = str.replace(ANSI_RE, "");
	const pad = Math.max(0, width - visible.length);
	return str + " ".repeat(pad);
}

function logStep(icon: string, msg: string, stepNum: number, startTime: number): void {
	const num = gb(`[${String(stepNum).padStart(2, "0")}]`);
	const ts = elapsed(startTime);
	console.log(`${num} ${icon} ${padRight(g(msg), LINE_W - 10)} ${ts}`);
}

export function createLogger(): Logger & { _stepCount: number; _startTime: number } {
	let stepCount = 0;
	const startTime = performance.now();

	function nextStep(icon: string, msg: string): void {
		stepCount++;
		logStep(icon, msg, stepCount, startTime);
	}

	return {
		_stepCount: 0,
		_startTime: startTime,

		step(msg: string) {
			nextStep(hi("\u25B6"), msg);
		},
		fetch(msg: string) {
			nextStep(gb("\u2B07"), msg);
		},
		process(msg: string) {
			nextStep(gb("\u2699"), msg);
		},
		llm(msg: string) {
			nextStep(gb("\u{1F916}"), msg);
		},
		send(msg: string) {
			nextStep(gb("\u{1F4E1}"), msg);
		},

		success(msg: string) {
			console.log(`${INDENT}${gb("\u2714")} ${gb(msg)}`);
		},
		warn(msg: string) {
			console.log(`${INDENT}${wrn("\u26A0")} ${wrn(msg)}`);
		},
		error(msg: string) {
			console.log(`${INDENT}${err("\u2718")} ${err(msg)}`);
		},

		flag(result: HubResponse) {
			console.log();
			if (result.code === 0) {
				console.log(`  ${LINE}`);
				console.log(hi(`  \u{1F3C1} ${result.message}`));
				console.log(`  ${LINE}`);
			} else {
				console.log(
					`${INDENT}${err("\u2718")} ${err(`Hub error [${result.code}]: ${result.message}`)}`,
				);
			}
		},

		info(msg: string) {
			console.log(`${INDENT}${dim(msg)}`);
		},
		detail(msg: string) {
			console.log(`${INDENT}${gd(msg)}`);
		},
	};
}

function visibleLength(str: string): number {
	return str.replace(ANSI_RE, "").length;
}

export function printBanner(task: TaskDefinition): void {
	const season = `S${String(task.season).padStart(2, "0")}`;
	const episode = `E${String(task.episode).padStart(2, "0")}`;
	const line1raw = "MISSION CONTROL  \u00B7  AI_devs 4";
	const line2raw = `${season}${episode} \u00B7 ${task.name} \u00B7 ${task.title}`;
	const width = Math.max(line1raw.length, line2raw.length) + 4;

	const top = gd(`\u250C${"─".repeat(width)}\u2510`);
	const bot = gd(`\u2514${"─".repeat(width)}\u2518`);
	const row = (colored: string) => {
		const pad = width - visibleLength(colored) - 2;
		return `${gd("\u2502")}  ${colored}${" ".repeat(Math.max(0, pad))}${gd("\u2502")}`;
	};

	console.log();
	console.log(top);
	console.log(row(hi(line1raw)));
	console.log(row(g(line2raw)));
	console.log(bot);
	console.log();
}

export function printSummary(stats: { cost: number; llmCalls: number; durationMs: number }): void {
	const cost = `$${stats.cost.toFixed(4)}`;
	const duration = `${(stats.durationMs / 1000).toFixed(1)}s`;
	const calls = `${stats.llmCalls} LLM call${stats.llmCalls !== 1 ? "s" : ""}`;

	console.log();
	console.log(
		`  ${gb("\u2714")} ${hi("TASK COMPLETED")}  ${dim(`${cost} | ${calls} | ${duration}`)}`,
	);
	console.log();
}

export function printTaskList(
	tasks: Map<string, TaskDefinition>,
	statuses: Record<string, TaskStatus>,
): void {
	if (tasks.size === 0) {
		console.log(dim("\n  No tasks found.\n"));
		return;
	}

	const bySeason = new Map<number, { task: TaskDefinition; status: TaskStatus["status"] }[]>();
	for (const [name, task] of tasks) {
		const season = task.season;
		if (!bySeason.has(season)) bySeason.set(season, []);
		bySeason.get(season)?.push({ task, status: statuses[name]?.status ?? "new" });
	}

	console.log();
	for (const [season, entries] of bySeason) {
		const parts = entries.map(({ task, status }) => {
			const icon =
				status === "completed" ? gb("\u2714") : status === "failed" ? err("\u2718") : dim("\u00B7");
			return `${g("[")}${icon}${g("]")} ${g(task.name)}`;
		});
		console.log(`  ${dim(`S${String(season).padStart(2, "0")}`)}  ${parts.join("  ")}`);
	}
	console.log();
}
