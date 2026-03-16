import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { discoverTasks, loadStatus, saveStatus } from "../task-registry.js";

describe("task-registry", () => {
	let tempDir: string;

	beforeEach(async () => {
		tempDir = await mkdtemp(join(tmpdir(), "task-registry-test-"));
	});

	afterEach(async () => {
		await rm(tempDir, { recursive: true, force: true });
	});

	describe("discoverTasks", () => {
		it("returns empty map for nonexistent directory", async () => {
			const tasks = await discoverTasks("/nonexistent/path");
			expect(tasks.size).toBe(0);
		});

		it("returns empty map for empty directory", async () => {
			const tasks = await discoverTasks(tempDir);
			expect(tasks.size).toBe(0);
		});

		it("skips directories without index.ts", async () => {
			await mkdir(join(tempDir, "s01e01-test"));
			const tasks = await discoverTasks(tempDir);
			expect(tasks.size).toBe(0);
		});

		it("discovers a valid task", async () => {
			const taskDir = join(tempDir, "s01e01-test");
			await mkdir(taskDir);
			await writeFile(
				join(taskDir, "index.ts"),
				`export default {
					name: "test",
					title: "Test Task",
					season: 1,
					episode: 1,
					async run() {},
				};`,
			);

			const tasks = await discoverTasks(tempDir);
			expect(tasks.size).toBe(1);
			expect(tasks.has("test")).toBe(true);
			const task = tasks.get("test");
			expect(task).toBeDefined();
			expect(task.title).toBe("Test Task");
			expect(task.season).toBe(1);
			expect(task.episode).toBe(1);
		});

		it("sorts tasks by season then episode", async () => {
			for (const [name, season, episode] of [
				["b-task", 1, 3],
				["a-task", 1, 1],
				["c-task", 2, 1],
			] as const) {
				const taskDir = join(tempDir, `s0${season}e0${episode}-${name}`);
				await mkdir(taskDir);
				await writeFile(
					join(taskDir, "index.ts"),
					`export default {
						name: "${name}",
						title: "${name}",
						season: ${season},
						episode: ${episode},
						async run() {},
					};`,
				);
			}

			const tasks = await discoverTasks(tempDir);
			const names = [...tasks.keys()];
			expect(names).toEqual(["a-task", "b-task", "c-task"]);
		});

		it("throws on invalid TaskDefinition", async () => {
			const taskDir = join(tempDir, "s01e01-bad");
			await mkdir(taskDir);
			await writeFile(
				join(taskDir, "index.ts"),
				`export default { name: "bad" };`, // missing required fields
			);

			await expect(discoverTasks(tempDir)).rejects.toThrow(
				"does not export a valid TaskDefinition",
			);
		});

		it("throws on duplicate task name", async () => {
			for (const dir of ["s01e01-first", "s01e02-second"]) {
				const taskDir = join(tempDir, dir);
				await mkdir(taskDir);
				await writeFile(
					join(taskDir, "index.ts"),
					`export default {
						name: "dupe",
						title: "Duplicate",
						season: 1,
						episode: 1,
						async run() {},
					};`,
				);
			}

			await expect(discoverTasks(tempDir)).rejects.toThrow('Duplicate task name "dupe"');
		});
	});

	describe("loadStatus / saveStatus", () => {
		it("returns empty object when no status file exists", async () => {
			const status = await loadStatus(tempDir);
			expect(status).toEqual({});
		});

		it("saves and loads status correctly", async () => {
			const status = {
				people: { status: "completed" as const, flag: "{FLG:TEST}", cost: 0.003 },
				findhim: { status: "pending" as const },
			};

			await saveStatus(tempDir, status);
			const loaded = await loadStatus(tempDir);
			expect(loaded).toEqual(status);

			// Verify file is properly formatted JSON
			const raw = await readFile(join(tempDir, ".status.json"), "utf-8");
			expect(raw).toContain("\n"); // pretty printed
			expect(raw.endsWith("\n")).toBe(true); // trailing newline
		});
	});
});
