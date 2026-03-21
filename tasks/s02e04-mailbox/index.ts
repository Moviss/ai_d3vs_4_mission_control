import type { TaskDefinition, ToolDefinition } from "@mission/core";

const ZMAIL_URL = "https://hub.ag3nts.org/api/zmail";
const TASK_NAME = "mailbox";

interface SearchMailArgs {
	query: string;
	page?: number;
	perPage?: number;
}

interface ReadMailArgs {
	ids: string;
}

interface SubmitAnswerArgs {
	date: string;
	password: string;
	confirmation_code: string;
}

interface FinishArgs {
	summary: string;
}

export default {
	name: TASK_NAME,
	title: "S02E04 — Search mailbox for date, password and confirmation code",
	season: 2,
	episode: 4,

	async run(ctx) {
		const { hub, llm, log } = ctx;

		let flagFound = false;

		const tools: ToolDefinition[] = [
			{
				name: "search_mail",
				description: `Search the mailbox using Gmail-like query operators (from:, to:, subject:, OR, AND). Returns a list of emails with metadata (rowID, messageID, subject, from, to, date, snippet) but NOT full message content. Use read_mail to get full content.`,
				parameters: {
					type: "object",
					properties: {
						query: {
							type: "string",
							description:
								"Search query with Gmail-like operators, e.g. 'from:proton.me', 'subject:password OR hasło'",
						},
						page: { type: "number", description: "Page number (default 1)" },
						perPage: { type: "number", description: "Results per page, 5-20 (default 5)" },
					},
					required: ["query"],
				},
				async execute(args: unknown) {
					const { query, page, perPage } = args as SearchMailArgs;
					log.fetch(`search: "${query}" page=${page ?? 1}`);
					const result = await hub.post(ZMAIL_URL, {
						action: "search",
						query,
						page: page ?? 1,
						perPage: perPage ?? 10,
					});
					return result;
				},
			},
			{
				name: "read_mail",
				description: `Fetch the full content of one or more emails by their messageID. Always read full messages before extracting information — snippets may be incomplete.`,
				parameters: {
					type: "object",
					properties: {
						ids: {
							type: "string",
							description: "Comma-separated messageIDs to fetch",
						},
					},
					required: ["ids"],
				},
				async execute(args: unknown) {
					const { ids } = args as ReadMailArgs;
					log.fetch(`read: ${ids}`);
					const result = await hub.post(ZMAIL_URL, { action: "getMessages", ids });
					return result;
				},
			},
			{
				name: "submit_answer",
				description: `Submit the three extracted values to the hub for verification. Returns feedback on whether the answer is correct or which values are wrong. Only call when you have confident values for ALL three fields.`,
				parameters: {
					type: "object",
					properties: {
						date: {
							type: "string",
							description: "Attack date in YYYY-MM-DD format",
						},
						password: {
							type: "string",
							description: "Employee system password",
						},
						confirmation_code: {
							type: "string",
							description: "Security ticket confirmation code (format: SEC- + 28 characters = 32 chars total)",
						},
					},
					required: ["date", "password", "confirmation_code"],
				},
				async execute(args: unknown) {
					const answer = args as SubmitAnswerArgs;
					log.send(
						`Submitting: date=${answer.date} password=${answer.password} code=${answer.confirmation_code}`,
					);
					const result = await hub.verify(TASK_NAME, answer);
					log.flag(result);

					if (result.message.includes("{FLG:")) {
						flagFound = true;
					}
					return { code: result.code, message: result.message };
				},
			},
			{
				name: "finish",
				description: `Call this to end the agent loop when the flag has been obtained or you are certain you cannot make further progress. Provide a brief summary of findings.`,
				parameters: {
					type: "object",
					properties: {
						summary: { type: "string", description: "Brief summary of what was found" },
					},
					required: ["summary"],
				},
				async execute(args: unknown) {
					const { summary } = args as FinishArgs;
					log.info(summary);
					return "Agent loop ended.";
				},
			},
		];

		log.step("Discovering zmail API capabilities");
		const helpResult = await hub.post(ZMAIL_URL, { action: "help" });
		log.detail(`API help: ${JSON.stringify(helpResult)}`);

		const systemPrompt = `You are an investigative agent searching through an email inbox.

## Mission
Find exactly three pieces of information from the operator's mailbox:
1. **date** — when (YYYY-MM-DD) the security department plans to attack our power plant
2. **password** — the password to the employee system
3. **confirmation_code** — confirmation code from a security department ticket (format: SEC- + 28 characters = 32 chars total)

## Context
- Wiktor from the resistance sent a tip-off about us from a proton.me address
- The mailbox is actively receiving new messages — if you can't find something, try again
- Search supports Gmail operators: from:, to:, subject:, OR, AND

## API Reference
${JSON.stringify(helpResult, null, 2)}

## Rules
- ALWAYS use read_mail to get full message content before extracting data — snippets are truncated
- Search broadly first, then narrow down. Try different keywords in Polish and English
- If a search returns no results, try synonyms or different operators
- Verify confirmation_code is exactly 32 chars (SEC- + 28 chars) before submitting
- After a failed submission, analyze the feedback and keep searching
- New emails may arrive during your work — retry searches if needed
- Call finish when done`;

		log.step("Starting mailbox agent loop");

		const result = await llm.chat({
			model: "google/gemini-2.5-flash",
			system: systemPrompt,
			messages: [
				{
					role: "user",
					content:
						"Find the attack date, employee system password, and security confirmation code. " +
						"Start by searching for Wiktor's email from proton.me, then search for password and security ticket info.",
				},
			],
			tools,
			maxIterations: 50,
		});

		if (flagFound) {
			log.success("Flag obtained!");
		} else {
			log.warn("Agent finished without obtaining the flag");
			log.info(`Agent: ${result.content}`);
		}
	},
} satisfies TaskDefinition;
