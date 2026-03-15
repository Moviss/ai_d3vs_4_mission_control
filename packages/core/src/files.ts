import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export function getDataDir(taskDir: string): string {
	return join(taskDir, "data");
}

export async function ensureDataDir(taskDir: string): Promise<string> {
	const dir = getDataDir(taskDir);
	await mkdir(dir, { recursive: true });
	return dir;
}

export async function readDataFile(taskDir: string, filename: string): Promise<string> {
	const filePath = join(getDataDir(taskDir), filename);
	return readFile(filePath, "utf-8");
}

export async function readDataFileBuffer(taskDir: string, filename: string): Promise<Buffer> {
	const filePath = join(getDataDir(taskDir), filename);
	return readFile(filePath);
}

export async function writeDataFile(
	taskDir: string,
	filename: string,
	content: string | Buffer,
): Promise<void> {
	const dir = await ensureDataDir(taskDir);
	const filePath = join(dir, filename);
	await writeFile(filePath, content);
}

export function dataFileExists(taskDir: string, filename: string): boolean {
	return existsSync(join(getDataDir(taskDir), filename));
}
