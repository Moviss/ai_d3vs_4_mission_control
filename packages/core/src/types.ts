import type { Hono } from "hono";

// TaskDefinition — contract exported by each task
export interface TaskDefinition {
	name: string;
	title: string;
	season: number;
	episode: number;
	server?: boolean;
	run(ctx: TaskContext): Promise<void>;
}

// TaskContext — injected into run()
export interface TaskContext {
	hub: HubClient;
	llm: LLMClient;
	log: Logger;
	data: string;
	server: TaskServer;
	env: EnvConfig;
}

// Hub API Client
export interface HubClient {
	verify(task: string, answer: unknown): Promise<HubResponse>;
	fetchData(path: string): Promise<string | Buffer>;
	post(endpoint: string, body: unknown): Promise<unknown>;
}

export interface HubResponse {
	code: number;
	message: string;
}

// LLM Client
export interface LLMClient {
	chat(opts: ChatOptions): Promise<ChatResult>;
	structured<T>(opts: StructuredOptions): Promise<StructuredResult<T>>;
}

export interface StructuredResult<T> {
	data: T;
	usage: TokenUsage;
}

export interface ChatOptions {
	model?: string;
	system?: string;
	messages: Message[];
	tools?: ToolDefinition[];
	maxIterations?: number;
}

export interface StructuredOptions {
	model?: string;
	system: string;
	user: string;
	schema: Record<string, unknown>;
	images?: string[];
}

export interface ChatResult {
	content: string;
	usage: TokenUsage;
}

export interface TokenUsage {
	promptTokens: number;
	completionTokens: number;
	totalTokens: number;
	cost: number;
}

// Logger
export interface Logger {
	step(msg: string): void;
	fetch(msg: string): void;
	process(msg: string): void;
	llm(msg: string): void;
	send(msg: string): void;
	success(msg: string): void;
	warn(msg: string): void;
	error(msg: string): void;
	flag(result: HubResponse): void;
	info(msg: string): void;
	detail(msg: string): void;
}

// Task Server (Hono-based)
export interface TaskServer {
	app: Hono;
	start(port?: number): Promise<{ url: string; port: number }>;
	stop(): Promise<void>;
	url: string;
}

// Tool definitions (Function Calling)
export interface ToolDefinition {
	name: string;
	description: string;
	parameters: Record<string, unknown>;
	execute: (args: unknown) => Promise<unknown>;
}

// Message (OpenAI-compatible)
export interface Message {
	role: "system" | "user" | "assistant" | "tool";
	content: string | null;
	tool_calls?: ToolCall[];
	tool_call_id?: string;
}

export interface ToolCall {
	id: string;
	type: "function";
	function: { name: string; arguments: string };
}

// Env
export interface EnvConfig {
	openrouterApiKey: string;
	ag3ntsApiKey: string;
	[key: string]: string;
}

// Task status tracking
export interface TaskStatus {
	status: "new" | "pending" | "completed" | "failed";
	flag?: string;
	lastRun?: string;
	cost?: number;
}
