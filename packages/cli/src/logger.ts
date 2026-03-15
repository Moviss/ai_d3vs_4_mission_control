import type { HubResponse, Logger, TaskDefinition } from "@mission/core";
import chalk from "chalk";

export function createLogger(): Logger {
	return {
		step(msg: string) {
			console.log(`  ${chalk.cyan("⬇")}  ${msg}`);
		},
		success(msg: string) {
			console.log(`  ${chalk.green("✓")}  ${chalk.green(msg)}`);
		},
		warn(msg: string) {
			console.log(`  ${chalk.yellow("⚠")}  ${chalk.yellow(msg)}`);
		},
		error(msg: string) {
			console.log(`  ${chalk.red("✗")}  ${chalk.red(msg)}`);
		},
		flag(result: HubResponse) {
			if (result.code === 0) {
				console.log(`  ${chalk.magenta.bold("🏁")}  ${chalk.magenta.bold(result.message)}`);
			} else {
				console.log(
					`  ${chalk.red("✗")}  ${chalk.red(`Hub error [${result.code}]: ${result.message}`)}`,
				);
			}
		},
		info(msg: string) {
			console.log(`  ${chalk.dim("ℹ")}  ${chalk.dim(msg)}`);
		},
		detail(msg: string) {
			console.log(`     ${chalk.dim(msg)}`);
		},
	};
}

export function printBanner(task: TaskDefinition): void {
	const season = `S${String(task.season).padStart(2, "0")}`;
	const episode = `E${String(task.episode).padStart(2, "0")}`;
	const line = `${season}${episode} · ${task.name} · ${task.title}`;
	const header = "MISSION CONTROL  ·  AI_devs 4";
	const width = Math.max(line.length, header.length) + 4;

	const top = `┌${"─".repeat(width)}┐`;
	const bottom = `└${"─".repeat(width)}┘`;
	const pad = (text: string) => `│  ${text}${" ".repeat(width - text.length - 2)}│`;

	console.log();
	console.log(chalk.dim(top));
	console.log(chalk.dim(pad(chalk.bold(header))));
	console.log(chalk.dim(pad(line)));
	console.log(chalk.dim(bottom));
	console.log();
}

export function printSummary(stats: {
	cost: number;
	llmCalls: number;
	durationMs: number;
}): void {
	const cost = `$${stats.cost.toFixed(4)}`;
	const duration = `${(stats.durationMs / 1000).toFixed(1)}s`;
	const line = `Koszt: ${cost} | ${stats.llmCalls} wywołania LLM | ${duration}`;

	console.log();
	console.log(`  ${"─".repeat(44)}`);
	console.log(`  ${chalk.dim(line)}`);
}
