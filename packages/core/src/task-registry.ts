import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { TaskDefinition, TaskStatus } from "./types.js";

function isTaskDefinition(value: unknown): value is TaskDefinition {
	if (typeof value !== "object" || value === null) return false;
	const obj = value as Record<string, unknown>;
	return (
		typeof obj.name === "string" &&
		typeof obj.title === "string" &&
		typeof obj.season === "number" &&
		typeof obj.episode === "number" &&
		typeof obj.run === "function"
	);
}

export async function discoverTasks(tasksDir: string): Promise<Map<string, TaskDefinition>> {
	const tasks = new Map<string, TaskDefinition>();

	let entries: string[];
	try {
		entries = await readdir(tasksDir);
	} catch {
		return tasks;
	}

	for (const entry of entries) {
		const entryPath = join(tasksDir, entry);
		const entryStat = await stat(entryPath);
		if (!entryStat.isDirectory()) continue;

		const indexPath = join(entryPath, "index.ts");
		try {
			await stat(indexPath);
		} catch {
			continue;
		}

		const mod = await import(indexPath);
		const definition = mod.default;

		if (!isTaskDefinition(definition)) {
			throw new Error(`Task "${entry}" does not export a valid TaskDefinition as default export`);
		}

		if (tasks.has(definition.name)) {
			throw new Error(`Duplicate task name "${definition.name}" found in "${entry}"`);
		}

		tasks.set(definition.name, definition);
	}

	// Sort by season → episode
	const sorted = new Map(
		[...tasks.entries()].sort(([, a], [, b]) => {
			if (a.season !== b.season) return a.season - b.season;
			return a.episode - b.episode;
		}),
	);

	return sorted;
}

const STATUS_FILE = ".status.json";

export function loadStatus(tasksDir: string): Promise<Record<string, TaskStatus>> {
	const filePath = join(tasksDir, STATUS_FILE);
	return readFile(filePath, "utf-8")
		.then((data) => JSON.parse(data) as Record<string, TaskStatus>)
		.catch(() => ({}));
}

export async function saveStatus(
	tasksDir: string,
	status: Record<string, TaskStatus>,
): Promise<void> {
	const filePath = join(tasksDir, STATUS_FILE);
	await writeFile(filePath, `${JSON.stringify(status, null, 2)}\n`, "utf-8");
}
