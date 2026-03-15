import { readdir, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
	createHubClient,
	createLLMClient,
	createTaskServer,
	discoverTasks,
	ensureDataDir,
	getDataDir,
	loadEnv,
	loadStatus,
	saveStatus,
} from "@mission/core";
import type { HubClient, LLMClient, TaskContext, TaskDefinition } from "@mission/core";
import { createLogger, printBanner, printSummary, printTaskList } from "./logger.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, "..", "..", "..");
const TASKS_DIR = resolve(PROJECT_ROOT, "tasks");

async function main(): Promise<void> {
	const args = process.argv.slice(2);

	const listMode = args.includes("--list");
	const dryMode = args.includes("--dry");
	const taskName = args.find((a) => !a.startsWith("--"));

	if (listMode) {
		const tasks = await discoverTasks(TASKS_DIR);
		const statuses = await loadStatus(TASKS_DIR);
		printTaskList(tasks, statuses);
		return;
	}

	if (!taskName) {
		console.log("Usage: pnpm task <name>        run a task");
		console.log("       pnpm task --list        list all tasks");
		console.log("       pnpm task <name> --dry  dry run (no hub submission)");
		process.exit(1);
	}

	await runTask(taskName, dryMode);
}

async function runTask(name: string, dry: boolean): Promise<void> {
	const log = createLogger();

	// 1. Load env
	let env: ReturnType<typeof loadEnv>;
	try {
		env = loadEnv(PROJECT_ROOT);
	} catch (e) {
		log.error((e as Error).message);
		process.exit(1);
	}

	// 2. Discover tasks and resolve name
	const tasks = await discoverTasks(TASKS_DIR);
	const { task, dirName: taskDirName, resolvedName } = await resolveTask(TASKS_DIR, tasks, name);

	if (!task || !taskDirName) {
		log.error(`Task "${name}" not found`);
		const available = [...tasks.keys()];
		if (available.length > 0) {
			log.info(`Available tasks: ${available.join(", ")}`);
		} else {
			log.info("No tasks found in tasks/ directory");
		}
		process.exit(1);
	}

	const taskDir = resolve(TASKS_DIR, taskDirName);
	await ensureDataDir(taskDir);

	const hub = createHubClient(env);
	const hubClient = dry ? createDryHubClient(hub, log) : hub;
	const { client: trackedLLM, stats: llmStats } = createTrackedLLMClient(createLLMClient(env, log));
	const server = createTaskServer();

	const ctx: TaskContext = {
		hub: hubClient,
		llm: trackedLLM,
		log,
		data: getDataDir(taskDir),
		server,
		env,
	};

	// 4. Run task
	printBanner(task);

	if (dry) {
		log.warn("DRY RUN — hub.verify() calls will be logged but not sent");
		console.log();
	}

	const statuses = await loadStatus(TASKS_DIR);
	const startTime = performance.now();

	try {
		await task.run(ctx);

		const durationMs = performance.now() - startTime;
		printSummary({ cost: llmStats.cost, llmCalls: llmStats.calls, durationMs });

		statuses[resolvedName] = {
			status: "completed",
			lastRun: new Date().toISOString(),
			cost: llmStats.cost,
		};
		await saveStatus(TASKS_DIR, statuses);
	} catch (e) {
		const error = e as Error;
		log.error(error.message);
		if (error.stack) {
			log.detail(error.stack);
		}

		statuses[resolvedName] = {
			status: "failed",
			lastRun: new Date().toISOString(),
			cost: llmStats.cost,
		};
		await saveStatus(TASKS_DIR, statuses);
		process.exit(1);
	} finally {
		if (task.server) {
			await server.stop();
		}
	}
}

/**
 * Resolves a user-provided name to a task. Supports:
 *   - task name:    "people"
 *   - episode code: "s01e01"
 *   - full dir:     "s01e01-people"
 */
async function resolveTask(
	tasksDir: string,
	tasks: Map<string, TaskDefinition>,
	input: string,
): Promise<{
	task: TaskDefinition | undefined;
	dirName: string | undefined;
	resolvedName: string;
}> {
	// 1. Exact match by task name
	if (tasks.has(input)) {
		const dirName = await findDirByName(tasksDir, input);
		return { task: tasks.get(input), dirName, resolvedName: input };
	}

	// 2. Match by episode code (s01e01) or full dir name (s01e01-people)
	const normalized = input.toLowerCase();
	let entries: string[];
	try {
		entries = await readdir(tasksDir);
	} catch {
		return { task: undefined, dirName: undefined, resolvedName: input };
	}

	for (const entry of entries) {
		const entryPath = join(tasksDir, entry);
		const entryStat = await stat(entryPath);
		if (!entryStat.isDirectory()) continue;

		// Match "s01e01-people" exactly or "s01e01" as prefix
		if (entry.toLowerCase() === normalized || entry.toLowerCase().startsWith(`${normalized}-`)) {
			// Extract task name from directory (part after sXXeYY-)
			const taskName = entry.replace(/^s\d+e\d+-/, "");
			const task = tasks.get(taskName);
			if (task) {
				return { task, dirName: entry, resolvedName: taskName };
			}
		}
	}

	return { task: undefined, dirName: undefined, resolvedName: input };
}

async function findDirByName(tasksDir: string, taskName: string): Promise<string | undefined> {
	let entries: string[];
	try {
		entries = await readdir(tasksDir);
	} catch {
		return undefined;
	}

	for (const entry of entries) {
		const entryPath = join(tasksDir, entry);
		const entryStat = await stat(entryPath);
		if (!entryStat.isDirectory()) continue;

		if (entry.endsWith(`-${taskName}`)) {
			return entry;
		}
	}
	return undefined;
}

function createDryHubClient(hub: HubClient, log: ReturnType<typeof createLogger>): HubClient {
	return {
		async verify(task, answer) {
			log.info(`[DRY] Would verify task="${task}" with answer:`);
			log.detail(JSON.stringify(answer, null, 2));
			return { code: 0, message: "[DRY RUN] No flag — verify not sent" };
		},
		fetchData: hub.fetchData.bind(hub),
		post: hub.post.bind(hub),
	};
}

function createTrackedLLMClient(llm: LLMClient): {
	client: LLMClient;
	stats: { calls: number; cost: number };
} {
	const stats = { calls: 0, cost: 0 };
	return {
		client: {
			async chat(opts) {
				stats.calls++;
				const result = await llm.chat(opts);
				stats.cost += result.usage.cost;
				return result;
			},
			async structured<T>(opts: Parameters<LLMClient["structured"]>[0]) {
				stats.calls++;
				const result = await llm.structured<T>(opts);
				stats.cost += result.usage.cost;
				return result;
			},
		},
		stats,
	};
}

main();
