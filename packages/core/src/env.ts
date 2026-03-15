import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { EnvConfig } from "./types.js";

const REQUIRED_VARS = ["OPENROUTER_API_KEY", "AG3NTS_API_KEY"] as const;

function parseEnvFile(filePath: string): Record<string, string> {
	let content: string;
	try {
		content = readFileSync(filePath, "utf-8");
	} catch {
		return {};
	}

	const vars: Record<string, string> = {};
	for (const line of content.split("\n")) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) continue;

		const eqIndex = trimmed.indexOf("=");
		if (eqIndex === -1) continue;

		const key = trimmed.slice(0, eqIndex).trim();
		let value = trimmed.slice(eqIndex + 1).trim();

		// Strip surrounding quotes
		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		}

		vars[key] = value;
	}
	return vars;
}

export function loadEnv(rootDir?: string): EnvConfig {
	const root = rootDir ?? process.cwd();
	const envPath = resolve(root, ".env");

	// .env file values are loaded but don't override existing process.env
	const fileVars = parseEnvFile(envPath);
	for (const [key, value] of Object.entries(fileVars)) {
		if (!(key in process.env)) {
			process.env[key] = value;
		}
	}

	// Validate required variables
	const missing = REQUIRED_VARS.filter((key) => !process.env[key]);
	if (missing.length > 0) {
		throw new Error(
			`Missing required environment variables: ${missing.join(", ")}\nCreate a .env file in the project root or set them in your shell.\nSee .env.example for reference.`,
		);
	}

	return {
		openrouterApiKey: process.env.OPENROUTER_API_KEY as string,
		ag3ntsApiKey: process.env.AG3NTS_API_KEY as string,
	};
}
