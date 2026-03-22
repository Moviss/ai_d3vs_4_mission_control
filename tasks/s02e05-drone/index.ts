import type { TaskDefinition, ToolDefinition } from "@mission/core";

const TASK_NAME = "drone";
const PLANT_ID = "PWR6132PL";

const DRONE_API_DOCS = `## DRN-BMB7 Drone API

### Endpoint: POST /verify
Required: apikey, task="drone", answer.instructions (array of strings, min 1 element)

### Control Methods (set() is overloaded — system resolves by parameter format):
| Method | Description | Example |
|--------|-------------|---------|
| setDestinationObject(ID) | Target object. Format: [A-Z]{3}[0-9]+[A-Z]{2} | setDestinationObject(BLD1234PL) |
| set(x,y) | Landing sector. x=column, y=row. Origin (1,1) top-left. | set(3,4) |
| set(mode) | Engine toggle: engineON or engineOFF | set(engineON) |
| set(power) | Engine throttle 0%-100% | set(1%) |
| set(xm) | Flight altitude 1m-100m | set(4m) |
| flyToLocation | Start flight (no params). Needs altitude, destination, sector set first. | flyToLocation |
| selfCheck | System diagnostics | selfCheck |
| setName(x) | Alphanumeric name with spaces | setName(Fox 21) |
| setOwner(Name Surname) | Exactly two words | setOwner(Adam Kowalski) |
| setLed(color) | LED in #RRGGBB | setLed(#FF8800) |
| getFirmwareVersion | Software version | getFirmwareVersion |
| getConfig | Current config | getConfig |
| calibrateCompass | Compass calibration | calibrateCompass |
| calibrateGPS | GPS calibration | calibrateGPS |
| hardReset | Factory reset | hardReset |

### Mission Objectives (multiple allowed, order irrelevant — drone AI sequences them):
- set(video) — record footage
- set(image) — capture photo
- set(destroy) — destroy target
- set(return) — return to base with report

### Notes:
- DRN-BMB7 always carries one small-range explosive charge
- flyToLocation requires altitude, destination object, and landing sector to be set first`;

export default {
	name: TASK_NAME,
	title: "S02E05 — Program drone to bomb dam near Żarnowiec",
	season: 2,
	episode: 5,

	async run(ctx) {
		const { hub, llm, log, env } = ctx;

		// Phase 1: Download and analyze map with vision model
		log.step("Downloading terrain map");
		const mapUrl = `https://hub.ag3nts.org/data/${env.ag3ntsApiKey}/drone.png`;
		const response = await fetch(mapUrl);
		const buffer = Buffer.from(await response.arrayBuffer());
		const base64 = buffer.toString("base64");
		const dataUrl = `data:image/png;base64,${base64}`;
		log.info(`Map downloaded (${buffer.length} bytes)`);

		// Run two independent vision analyses for accuracy
		log.step("Analyzing map with two vision models");

		interface SectorDescription {
			column: number;
			row: number;
			contents: string;
		}

		interface MapAnalysis {
			totalColumns: number;
			totalRows: number;
			sectors: SectorDescription[];
			damColumn: number;
			damRow: number;
			reasoning: string;
		}

		const visionPrompt = {
			system: `You are a military cartographic analyst. You must analyze a terrain map divided into a rectangular grid with EXTREME precision.

COUNTING RULES:
- The map is divided by GRID LINES into rectangular CELLS (sectors).
- Count the number of CELLS, not lines. If there are N vertical lines inside the map (not counting edges), there are N+1 columns.
- Columns are numbered left-to-right starting at 1. Rows are numbered top-to-bottom starting at 1.
- Origin (1,1) is the TOP-LEFT cell.

DAM IDENTIFICATION:
- A dam (tama/zapora) is a wall/barrier structure that holds back water.
- The task says water color near the dam was DELIBERATELY INTENSIFIED (made brighter blue) to help locate it.
- Look for an area with unnaturally bright/vivid blue water — that's where the dam is.
- The dam separates the reservoir/lake from the area below it.

PROCEDURE:
1. First, count ALL vertical dividers inside the map to determine columns.
2. Then count ALL horizontal dividers to determine rows.
3. List what you see in EVERY sector (row by row, left to right).
4. Identify which sector has the dam (bright blue water + barrier structure).`,
			user: `Analyze this terrain map SECTOR BY SECTOR:

Step 1: Count grid divisions carefully. How many columns? How many rows?
Step 2: For each sector (row by row, left to right), describe what you see: terrain type, buildings, water, roads, etc.
Step 3: Which sector has the DAM with the intensified blue water?

Be extremely precise. Lives depend on correct coordinates.`,
			schema: {
				type: "object",
				properties: {
					totalColumns: {
						type: "number",
						description: "Total number of columns (cells) in the grid",
					},
					totalRows: {
						type: "number",
						description: "Total number of rows (cells) in the grid",
					},
					sectors: {
						type: "array",
						items: {
							type: "object",
							properties: {
								column: { type: "number" },
								row: { type: "number" },
								contents: {
									type: "string",
									description: "What is visible in this sector",
								},
							},
							required: ["column", "row", "contents"],
						},
						description:
							"Description of every sector, row by row left to right",
					},
					damColumn: {
						type: "number",
						description:
							"Column of the dam sector (with intensified blue water)",
					},
					damRow: {
						type: "number",
						description:
							"Row of the dam sector (with intensified blue water)",
					},
					reasoning: {
						type: "string",
						description:
							"Step-by-step: grid line count, sector descriptions, dam identification logic",
					},
				},
				required: [
					"totalColumns",
					"totalRows",
					"sectors",
					"damColumn",
					"damRow",
					"reasoning",
				],
			},
		};

		const [analysis1, analysis2] = await Promise.all([
			llm.structured<MapAnalysis>({
				model: "google/gemini-2.5-pro",
				...visionPrompt,
				images: [dataUrl],
			}),
			llm.structured<MapAnalysis>({
				model: "openai/gpt-4.1",
				...visionPrompt,
				images: [dataUrl],
			}),
		]);

		log.info(
			`Model 1 (gemini-2.5-pro): ${analysis1.data.totalColumns}×${analysis1.data.totalRows} grid, dam at (${analysis1.data.damColumn},${analysis1.data.damRow})`,
		);
		log.detail(analysis1.data.reasoning);
		for (const s of analysis1.data.sectors) {
			log.detail(`  [${s.column},${s.row}]: ${s.contents}`);
		}

		log.info(
			`Model 2 (gpt-4.1): ${analysis2.data.totalColumns}×${analysis2.data.totalRows} grid, dam at (${analysis2.data.damColumn},${analysis2.data.damRow})`,
		);
		log.detail(analysis2.data.reasoning);
		for (const s of analysis2.data.sectors) {
			log.detail(`  [${s.column},${s.row}]: ${s.contents}`);
		}

		// Use consensus or provide both to the agent
		const a1 = analysis1.data;
		const a2 = analysis2.data;
		const damCandidates: string[] = [];
		damCandidates.push(`(${a1.damColumn},${a1.damRow})`);
		if (a1.damColumn !== a2.damColumn || a1.damRow !== a2.damRow) {
			damCandidates.push(`(${a2.damColumn},${a2.damRow})`);
			log.warn("Models disagree on dam location — agent will try both");
		} else {
			log.success(
				`Both models agree: dam at (${a1.damColumn},${a1.damRow})`,
			);
		}

		const gridInfo = `Grid: ${a1.totalColumns}×${a1.totalRows} (model1) / ${a2.totalColumns}×${a2.totalRows} (model2)`;
		log.info(gridInfo);

		// Phase 2: Agent loop — send drone instructions and iterate on feedback
		log.step("Starting drone programming agent");
		let flagFound = false;

		const tools: ToolDefinition[] = [
			{
				name: "submit_instructions",
				description:
					"Send an array of instruction strings to the drone API. Returns the API response with status and error messages. Read errors carefully to adjust your next attempt.",
				parameters: {
					type: "object",
					properties: {
						instructions: {
							type: "array",
							items: { type: "string" },
							description:
								"Array of drone instructions, e.g. ['hardReset', 'setDestinationObject(PWR6132PL)', 'set(3,4)', 'flyToLocation']",
						},
					},
					required: ["instructions"],
				},
				async execute(args: unknown) {
					const { instructions } = args as { instructions: string[] };
					log.send(
						`Sending ${instructions.length} instructions: ${JSON.stringify(instructions)}`,
					);
					const result = await hub.verify(TASK_NAME, { instructions });
					if (result.message.includes("{FLG:")) {
						flagFound = true;
						log.flag(result);
					} else {
						log.info(`API [${result.code}]: ${result.message}`);
					}
					return { code: result.code, message: result.message };
				},
			},
			{
				name: "finish",
				description:
					"End the agent loop when the flag is obtained or no further progress is possible.",
				parameters: {
					type: "object",
					properties: {
						summary: {
							type: "string",
							description: "Brief summary of outcome",
						},
					},
					required: ["summary"],
				},
				async execute(args: unknown) {
					const { summary } = args as { summary: string };
					log.info(summary);
					return "Done.";
				},
			},
		];

		// Build sector descriptions for the agent
		const sectorDescs = a1.sectors
			.map((s) => `(${s.column},${s.row}): ${s.contents}`)
			.join("\n");

		const systemPrompt = `You are programming a combat drone DRN-BMB7 for a critical mission.

## Mission
Bomb the DAM near the Żarnowiec power plant to restore water flow to the cooling system.
Official/cover target: power plant ${PLANT_ID}. Actual bomb target: the dam.

## Map Analysis
${gridInfo}

### Sector descriptions (from vision analysis):
${sectorDescs}

### Dam location candidates (from two independent vision analyses):
${damCandidates.map((c, i) => `Candidate ${i + 1}: ${c}`).join("\n")}

## Drone API
${DRONE_API_DOCS}

## Approach
1. Start EVERY attempt with hardReset to ensure clean state
2. Send ALL required instructions in a SINGLE call (hardReset + config + flyToLocation):
   - hardReset
   - setDestinationObject(${PLANT_ID})
   - set(col,row) — dam sector coordinates
   - set(engineON)
   - set(100%)
   - set(50m)
   - set(destroy)
   - flyToLocation
3. Read API error messages CAREFULLY and adjust

## CRITICAL: Sector Search Strategy
If the API says "you'll drop the bomb somewhere nearby" or similar, the coordinates are CLOSE but WRONG.
In that case:
- Try the other candidate coordinates first
- Then systematically try ALL adjacent sectors: (col-1,row), (col+1,row), (col,row-1), (col,row+1), (col-1,row-1), (col+1,row-1), (col-1,row+1), (col+1,row+1)
- Keep coordinates within valid grid bounds (1-based)
- NEVER give up until you've tried ALL reasonable sectors

## Rules
- ALWAYS include hardReset at the start of each instruction set
- Focus on mission-critical instructions only
- The set() function is overloaded — parameter format determines which action
- API errors tell you exactly what to fix — read them word by word
- Do NOT call finish until you've tried ALL sector candidates`;

		const result = await llm.chat({
			model: "google/gemini-2.5-flash",
			system: systemPrompt,
			messages: [
				{
					role: "user",
					content: `Program the drone to bomb the dam. Start with candidate coordinates ${damCandidates[0]}. If that fails with "nearby" message, systematically try all adjacent sectors. Target: ${PLANT_ID}.`,
				},
			],
			tools,
			maxIterations: 20,
		});

		if (flagFound) {
			log.success(
				"Mission accomplished! Dam destroyed, water flowing to cooling system.",
			);
		} else {
			log.warn("Agent finished without obtaining the flag");
			log.info(`Agent: ${result.content}`);
		}
	},
} satisfies TaskDefinition;
