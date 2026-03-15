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
import type { HubClient, LLMClient, TaskContext } from "@mission/core";
import { createLogger, printBanner, printSummary } from "./logger.js";
import { printTaskList } from "./ui.js";

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

	// 2. Discover tasks
	const tasks = await discoverTasks(TASKS_DIR);
	const task = tasks.get(name);

	if (!task) {
		log.error(`Task "${name}" not found`);
		const available = [...tasks.keys()];
		if (available.length > 0) {
			log.info(`Available tasks: ${available.join(", ")}`);
		} else {
			log.info("No tasks found in tasks/ directory");
		}
		process.exit(1);
	}

	// 3. Find task directory and build context
	const taskDirName = await findTaskDir(TASKS_DIR, name);
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

		statuses[name] = {
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

		statuses[name] = {
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

async function findTaskDir(tasksDir: string, taskName: string): Promise<string> {
	let entries: string[];
	try {
		entries = await readdir(tasksDir);
	} catch {
		throw new Error(`Tasks directory not found: ${tasksDir}`);
	}

	for (const entry of entries) {
		const entryPath = join(tasksDir, entry);
		const entryStat = await stat(entryPath);
		if (!entryStat.isDirectory()) continue;

		if (entry.endsWith(`-${taskName}`)) {
			return entry;
		}
	}

	throw new Error(`Task directory for "${taskName}" not found in ${tasksDir}`);
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
			async structured<T>(opts: Parameters<LLMClient["structured"]>[0]): Promise<T> {
				stats.calls++;
				return llm.structured<T>(opts);
			},
		},
		stats,
	};
}

main();
