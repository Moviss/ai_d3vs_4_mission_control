import type { TaskDefinition, TaskStatus } from "@mission/core";
import chalk from "chalk";

export function printTaskList(
	tasks: Map<string, TaskDefinition>,
	statuses: Record<string, TaskStatus>,
): void {
	if (tasks.size === 0) {
		console.log(chalk.dim("\n  No tasks found in tasks/ directory.\n"));
		return;
	}

	console.log();
	console.log(`  ${chalk.bold("MISSIONS")}${"".padEnd(32)}${chalk.bold("STATUS")}`);
	console.log(`  ${"─".repeat(52)}`);

	for (const [name, task] of tasks) {
		const season = `S${String(task.season).padStart(2, "0")}`;
		const episode = `E${String(task.episode).padStart(2, "0")}`;
		const status = statuses[name]?.status ?? "new";

		const id = chalk.dim(`${season}${episode}`);
		const taskName = name.padEnd(12);
		const title = task.title.slice(0, 20).padEnd(20);
		const statusLabel = formatStatus(status);

		console.log(`  ${id}  ${taskName} ${title} ${statusLabel}`);
	}

	console.log();
}

function formatStatus(status: TaskStatus["status"]): string {
	switch (status) {
		case "completed":
			return chalk.green("✓ DONE");
		case "pending":
			return chalk.yellow("○ PENDING");
		case "failed":
			return chalk.red("✗ FAILED");
		default:
			return chalk.dim("· NEW");
	}
}
