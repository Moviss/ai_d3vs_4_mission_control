import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { TaskDefinition } from "@mission/core";

const TASK_NAME = "negotiations";

interface Item {
	name: string;
	code: string;
}

interface City {
	name: string;
	code: string;
}

function loadCsv<T>(path: string, mapper: (cols: string[]) => T): T[] {
	const lines = readFileSync(path, "utf-8").trim().split("\n");
	return lines.slice(1).map((line) => mapper(line.split(",")));
}

function normalize(text: string): string {
	return text
		.toLowerCase()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/ł/g, "l");
}

/** Simple token-based scoring for pre-filtering */
function scoreMatch(query: string, itemName: string): number {
	const qTokens = normalize(query).split(/\s+/);
	const iTokens = normalize(itemName).split(/\s+/);
	let score = 0;
	for (const qt of qTokens) {
		if (qt.length < 2) continue;
		for (const it of iTokens) {
			if (it === qt) {
				score += 3;
			} else if (it.startsWith(qt) || qt.startsWith(it)) {
				score += 2;
			} else if (it.includes(qt) || qt.includes(it)) {
				score += 1;
			}
		}
	}
	return score;
}

export default {
	name: TASK_NAME,
	title: "S03E04 — Build tools for agent to find cities selling wind turbine parts",
	season: 3,
	episode: 4,
	server: true,

	async run(ctx) {
		const { hub, log, llm } = ctx;
		const dataDir = ctx.data;

		// Load data
		log.step("Loading CSV data");
		const items = loadCsv<Item>(join(dataDir, "items.csv"), (c) => ({
			name: c[0],
			code: c[1],
		}));
		const cities = loadCsv<City>(join(dataDir, "cities.csv"), (c) => ({
			name: c[0],
			code: c[1],
		}));
		const connections = loadCsv(
			join(dataDir, "connections.csv"),
			(c) => ({ itemCode: c[0], cityCode: c[1] }),
		);

		// Build lookup maps
		const cityByCode = new Map(cities.map((c) => [c.code, c.name]));
		const itemByCode = new Map(items.map((i) => [i.code, i.name]));
		const citiesForItem = new Map<string, string[]>();
		for (const conn of connections) {
			const cityName = cityByCode.get(conn.cityCode);
			if (!cityName) continue;
			const arr = citiesForItem.get(conn.itemCode) ?? [];
			arr.push(cityName);
			citiesForItem.set(conn.itemCode, arr);
		}

		// Group items by category (first word)
		const itemsByCategory = new Map<string, Item[]>();
		for (const item of items) {
			const cat = normalize(item.name.split(" ")[0]);
			const arr = itemsByCategory.get(cat) ?? [];
			arr.push(item);
			itemsByCategory.set(cat, arr);
		}

		log.info(
			`Loaded ${items.length} items, ${cities.length} cities, ${connections.length} connections`,
		);
		log.info(`Categories: ${[...itemsByCategory.keys()].join(", ")}`);

		// Tool endpoint
		ctx.server.app.post("/api/search", async (c) => {
			const body = await c.req.json<{ params: string }>();
			const query = body.params ?? "";
			log.info(`[search] Query: ${query}`);

			if (!query || query.length < 3) {
				return c.json({ output: "Please provide a more specific item description." });
			}

			try {
				// Pre-filter: score all items and take top candidates
				const scored = items
					.map((item) => ({ item, score: scoreMatch(query, item.name) }))
					.filter((s) => s.score > 0)
					.sort((a, b) => b.score - a.score);

				// If good matches found by keywords, narrow the candidate list
				let candidates: Item[];
				if (scored.length > 0 && scored[0].score >= 3) {
					candidates = scored.slice(0, 40).map((s) => s.item);
				} else {
					// Fallback: try to identify category and send all items from it
					const normQuery = normalize(query);
					let bestCat = "";
					let bestCatScore = 0;
					for (const [cat, catItems] of itemsByCategory) {
						if (normQuery.includes(cat) || cat.includes(normQuery.split(/\s+/)[0])) {
							if (catItems.length > bestCatScore) {
								bestCat = cat;
								bestCatScore = catItems.length;
							}
						}
					}
					candidates = bestCat
						? (itemsByCategory.get(bestCat) ?? items.slice(0, 50))
						: items.slice(0, 50);
				}

				// Use LLM to pick the best match
				const candidateList = candidates
					.map((i) => `${i.code}: ${i.name}`)
					.join("\n");

				const { data } = await llm.structured<{ codes: string[] }>({
					model: "openai/gpt-4.1-mini",
					system:
						"You match natural language product queries to items in a catalog. Return the codes of ALL items that match the query. If the query mentions specific parameters (voltage, wattage, resistance, etc.), match those precisely. Return at most 5 best matches. If nothing matches well, return an empty array.",
					user: `Query: "${query}"\n\nCatalog:\n${candidateList}`,
					schema: {
						type: "object",
						properties: {
							codes: {
								type: "array",
								items: { type: "string" },
								description: "Item codes that match the query",
							},
						},
						required: ["codes"],
					},
				});

				if (!data.codes.length) {
					log.warn("[search] No matches found");
					return c.json({
						output:
							"No matching items found. Try different keywords or check available categories: rezystor, kondensator, dioda, tranzystor, cewka, czujnik, turbina, inwerter, akumulator, wentylator, modul, stabilizator, mikrokontroler.",
					});
				}

				// Build response with cities
				const results: string[] = [];
				for (const code of data.codes.slice(0, 3)) {
					const itemName = itemByCode.get(code);
					if (!itemName) continue;
					const itemCities = citiesForItem.get(code) ?? [];
					results.push(
						`${itemName} (${code}): ${itemCities.length > 0 ? itemCities.join(", ") : "not available"}`,
					);
				}

				const output = results.join("\n");
				log.info(`[search] Response (${Buffer.byteLength(output)} bytes): ${output}`);

				// Truncate if needed
				let finalOutput = output;
				if (Buffer.byteLength(finalOutput) > 500) {
					while (Buffer.byteLength(finalOutput) > 497) {
						finalOutput = finalOutput.slice(0, -1);
					}
					finalOutput += "...";
				}

				return c.json({ output: finalOutput });
			} catch (err) {
				log.error(`[search] Error: ${(err as Error).message}`);
				return c.json({ output: "Search error. Please try again with different terms." });
			}
		});

		// Start server
		const port = ctx.env.PROXY_PORT ? Number(ctx.env.PROXY_PORT) : 3000;
		const { url } = await ctx.server.start(port);
		log.step(`Server running at ${url}`);

		const publicUrl = ctx.env.PROXY_URL;
		if (!publicUrl) {
			log.error(
				"PROXY_URL not set in .env — set it to your public ngrok URL",
			);
			log.info(`Start ngrok with: ngrok http ${port}`);
			log.step("Server is running. Press Ctrl+C to stop.");
			await new Promise(() => {});
			return;
		}

		// Submit tools to hub
		log.step("Submitting tools to hub");
		const toolDef = {
			tools: [
				{
					URL: `${publicUrl}/api/search`,
					description:
						"Search for items in the trading catalog and find which cities sell them. Send a natural language description of the item you need in the 'params' field. The tool returns matching items with their availability in cities. Use this tool for each item you need to find.",
				},
			],
		};

		log.info(`Tool definition: ${JSON.stringify(toolDef, null, 2)}`);
		const submitResult = await hub.verify(TASK_NAME, toolDef);
		log.info(`Submit response: ${JSON.stringify(submitResult)}`);

		// Poll for result
		log.step("Waiting for agent to use tools...");
		const MAX_POLLS = 20;
		for (let i = 0; i < MAX_POLLS; i++) {
			await new Promise((r) => setTimeout(r, 10_000));
			log.detail(`Polling attempt ${i + 1}/${MAX_POLLS}...`);
			try {
				const checkResult = await hub.verify(TASK_NAME, {
					action: "check",
				});
				log.info(
					`Check response [${checkResult.code}]: ${checkResult.message}`,
				);
				if (checkResult.message.includes("{FLG:")) {
					log.flag(checkResult);
					return;
				}
				if (
					checkResult.code === 200 ||
					checkResult.message.toLowerCase().includes("complete") ||
					checkResult.message.toLowerCase().includes("success")
				) {
					log.flag(checkResult);
					return;
				}
			} catch {
				log.detail("Check not ready yet...");
			}
		}

		log.warn("Polling timeout — check debug panel manually: https://hub.ag3nts.org/debug");
	},
} satisfies TaskDefinition;
