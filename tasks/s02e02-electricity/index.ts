import type { TaskDefinition, ToolDefinition } from "@mission/core";
import sharp from "sharp";

/**
 * ELECTRICITY TASK — Puzzle elektryczne 3x3
 *
 * Cel: Doprowadzić prąd do trzech elektrowni (PWR6132PL, PWR1593PL, PWR7264PL)
 * ze źródła zasilania awaryjnego (bottom-left, 3x1) przez obrót kafelków kablowych.
 *
 * Architektura: AGENT Z NARZĘDZIAMI (tool calling loop)
 *
 * Podejście:
 * 1. Narzędzie `read_board` pobiera PNG i analizuje PROGRAMISTYCZNIE (piksele)
 *    → zwraca TEKSTOWY opis planszy agentowi (jakie kable w każdej komórce)
 * 2. Agent (LLM) autonomicznie rozumuje o potrzebnych obrotach
 * 3. Narzędzie `rotate_cell` wykonuje obroty przez API
 * 4. Agent weryfikuje wywołując `read_board` po każdej partii obrotów
 *
 * Dlaczego programistyczna detekcja zamiast modelu wizyjnego?
 * Modele vision dawały niespójne wyniki na małych komórkach siatki.
 * Analiza pikselowa jest 100% deterministyczna — pełni rolę niezawodnego
 * "narzędzia do odczytu obrazu" dla agenta. Agent nadal sam rozumuje.
 */

type Dir = "top" | "right" | "bottom" | "left";
const POSITIONS = ["1x1", "1x2", "1x3", "2x1", "2x2", "2x3", "3x1", "3x2", "3x3"];

// ═══════════════════════════════════════════════════════════════════
// WARSTWA 1: DETEKCJA SIATKI — znajdowanie linii siatki z pikseli
// ═══════════════════════════════════════════════════════════════════

interface GridInfo {
	vLines: number[];
	hLines: number[];
	pixel: (x: number, y: number) => number;
}

function clusterWithWidth(sorted: number[], gap = 5): { center: number; width: number }[] {
	if (!sorted.length) return [];
	const clusters: number[][] = [[sorted[0]]];
	for (let i = 1; i < sorted.length; i++) {
		if (sorted[i] - sorted[i - 1] <= gap) clusters.at(-1)!.push(sorted[i]);
		else clusters.push([sorted[i]]);
	}
	return clusters.map((c) => ({
		center: Math.floor(c.reduce((a, b) => a + b) / c.length),
		width: c.length,
	}));
}

function cluster(sorted: number[], gap = 8): number[] {
	return clusterWithWidth(sorted, gap).map((c) => c.center);
}

async function detectGrid(buffer: Buffer): Promise<GridInfo> {
	const { data, info } = await sharp(buffer).grayscale().raw().toBuffer({ resolveWithObject: true });
	const { width, height } = info;
	const pixel = (x: number, y: number) => data[y * width + x];
	const DARK = 80;

	// Vertical grid lines: columns where >55% of pixels are dark
	const colDark = Array.from({ length: width }, (_, x) => {
		let c = 0;
		for (let y = 0; y < height; y++) if (pixel(x, y) < DARK) c++;
		return c / height;
	});
	const vCands = colDark.map((r, x) => ({ x, r })).filter((c) => c.r > 0.55).map((c) => c.x);
	const vLines = cluster(vCands);

	if (vLines.length < 4) throw new Error(`Grid detection: found ${vLines.length} vertical lines (need 4)`);

	// Horizontal grid lines — thin dark bands (≤8px) within grid column range
	const gridL = vLines[0];
	const gridR = vLines[3];
	const gridW = gridR - gridL;

	const rowDark = Array.from({ length: height }, (_, y) => {
		let c = 0;
		for (let x = gridL; x <= gridR; x++) if (pixel(x, y) < DARK) c++;
		return c / gridW;
	});
	const hCands = rowDark.map((r, y) => ({ y, r })).filter((c) => c.r > 0.85).map((c) => c.y);
	const hClusters = clusterWithWidth(hCands);
	const hLines = hClusters.filter((c) => c.width <= 8).map((c) => c.center);

	if (hLines.length < 4) throw new Error(`Grid detection: found ${hLines.length} horizontal lines (need 4)`);

	return { vLines: vLines.slice(0, 4), hLines: hLines.slice(0, 4), pixel };
}

// ═══════════════════════════════════════════════════════════════════
// WARSTWA 2: DETEKCJA KABLI — próbkowanie pikseli na krawędziach
// ═══════════════════════════════════════════════════════════════════

function detectConnections(grid: GridInfo): Dir[][] {
	const { vLines, hLines, pixel } = grid;
	const DARK_THRESHOLD = 100;
	const BORDER_WIDTH = 3;
	const SAMPLE_OFFSET = 8;
	const STRIP_HALF = 12;
	const CABLE_RATIO = 0.4;

	function hasCable(points: [number, number][]): boolean {
		let dark = 0;
		for (const [x, y] of points) if (pixel(x, y) < DARK_THRESHOLD) dark++;
		return dark / points.length > CABLE_RATIO;
	}

	const results: Dir[][] = [];

	for (let r = 0; r < 3; r++) {
		for (let c = 0; c < 3; c++) {
			const x1 = vLines[c] + BORDER_WIDTH;
			const x2 = vLines[c + 1] - BORDER_WIDTH;
			const y1 = hLines[r] + BORDER_WIDTH;
			const y2 = hLines[r + 1] - BORDER_WIDTH;
			const mx = Math.floor((x1 + x2) / 2);
			const my = Math.floor((y1 + y2) / 2);

			const conn: Dir[] = [];

			const topPts: [number, number][] = [];
			for (let dx = -STRIP_HALF; dx <= STRIP_HALF; dx++) topPts.push([mx + dx, y1 + SAMPLE_OFFSET]);
			if (hasCable(topPts)) conn.push("top");

			const botPts: [number, number][] = [];
			for (let dx = -STRIP_HALF; dx <= STRIP_HALF; dx++) botPts.push([mx + dx, y2 - SAMPLE_OFFSET]);
			if (hasCable(botPts)) conn.push("bottom");

			const leftPts: [number, number][] = [];
			for (let dy = -STRIP_HALF; dy <= STRIP_HALF; dy++) leftPts.push([x1 + SAMPLE_OFFSET, my + dy]);
			if (hasCable(leftPts)) conn.push("left");

			const rightPts: [number, number][] = [];
			for (let dy = -STRIP_HALF; dy <= STRIP_HALF; dy++) rightPts.push([x2 - SAMPLE_OFFSET, my + dy]);
			if (hasCable(rightPts)) conn.push("right");

			results.push(conn);
		}
	}

	return results;
}

/**
 * Formatuje stan planszy jako czytelny tekst dla agenta.
 *
 * Agent dostaje tę informację zamiast obrazka — tekstowa reprezentacja
 * jest deterministyczna i pozwala mu rozumować o obrotach.
 */
function formatBoard(connections: Dir[][]): string {
	const tileType = (conn: Dir[]): string => {
		if (conn.length === 0) return "empty";
		if (conn.length === 1) return "dead-end";
		if (conn.length === 4) return "cross";
		if (conn.length === 3) return "T-junction";
		// 2 connections
		const sorted = [...conn].sort();
		const key = sorted.join(",");
		if (key === "bottom,top" || key === "left,right") return "straight";
		return "corner";
	};

	const lines: string[] = [
		"Board state (3x3 grid):",
		"Power source: enters from LEFT at cell 3x1",
		"Power plants: exit RIGHT at cells 1x3, 2x3, 3x3",
		"",
		"Grid layout:",
		"  1x1 | 1x2 | 1x3  → PWR6132PL",
		"  ----|-----|----",
		"  2x1 | 2x2 | 2x3  → PWR1593PL",
		"  ----|-----|----",
		"  3x1 | 3x2 | 3x3  → PWR7264PL",
		"  ↑",
		"  power source",
		"",
		"Cell connections:",
	];

	for (let i = 0; i < 9; i++) {
		const conn = connections[i];
		lines.push(`  ${POSITIONS[i]}: [${conn.join(", ")}] (${tileType(conn)})`);
	}

	lines.push("");
	lines.push("Adjacency rules — for power to flow between two cells, BOTH must connect at the shared edge:");
	lines.push("  Horizontal neighbors: left cell needs 'right', right cell needs 'left'");
	lines.push("  Vertical neighbors: top cell needs 'bottom', bottom cell needs 'top'");
	lines.push("");
	lines.push("Rotation: each 90° CW transforms connections: top→right, right→bottom, bottom→left, left→top");

	return lines.join("\n");
}

// ═══════════════════════════════════════════════════════════════════
// WARSTWA 3: NARZĘDZIA AGENTA
// ═══════════════════════════════════════════════════════════════════

function createTools(
	apiKey: string,
	log: TaskDefinition["run"] extends (ctx: infer C) => unknown ? C extends { log: infer L } ? L : never : never,
	verify: (task: string, answer: unknown) => Promise<{ code: number; message: string }>,
	onFlag: (flag: string) => void,
): ToolDefinition[] {
	const imageUrl = `https://hub.ag3nts.org/data/${apiKey}/electricity.png`;

	async function fetchBoardBuffer(reset = false): Promise<Buffer> {
		const url = reset ? `${imageUrl}?reset=1` : imageUrl;
		const resp = await fetch(url);
		if (!resp.ok) throw new Error(`Failed to fetch board: ${resp.status}`);
		return Buffer.from(await resp.arrayBuffer());
	}

	return [
		{
			name: "read_board",
			description:
				"Fetches the current board PNG and analyzes it to determine cable connections in each of the 9 cells. " +
				"Returns a text description of the board state including each cell's connections (top/right/bottom/left) " +
				"and tile type (straight, corner, T-junction, etc). Use this to understand the current state before planning rotations.",
			parameters: {
				type: "object",
				properties: {},
				additionalProperties: false,
			},
			async execute() {
				try {
					log.fetch("Pobieranie i analiza planszy...");
					const buffer = await fetchBoardBuffer();
					const grid = await detectGrid(buffer);
					const connections = detectConnections(grid);
					const text = formatBoard(connections);
					log.process("Plansza przeanalizowana");
					return text;
				} catch (e) {
					const msg = e instanceof Error ? e.message : String(e);
					log.warn(`read_board error: ${msg}`);
					return `Error reading board: ${msg}`;
				}
			},
		},
		{
			name: "rotate_cell",
			description:
				"Rotates a single cell 90 degrees clockwise. One call = one 90° rotation. " +
				"To rotate 180°, call twice. To rotate 270° (= 90° counter-clockwise), call three times. " +
				"After rotation, connections transform: top→right, right→bottom, bottom→left, left→top. " +
				"When the puzzle is fully solved, the response will contain a flag {FLG:...}.",
			parameters: {
				type: "object",
				properties: {
					cell: {
						type: "string",
						description: "Cell position in format AxB where A=row(1-3), B=column(1-3). Example: '2x3'",
					},
				},
				required: ["cell"],
				additionalProperties: false,
			},
			async execute(args) {
				const { cell } = args as { cell: string };
				log.send(`Obrót ${cell}...`);

				const result = await verify("electricity", { rotate: cell });
				log.info(`Rotate ${cell}: ${result.message}`);

				const flagMatch = result.message.match(/\{FLG:[^}]+\}/);
				if (flagMatch) {
					onFlag(flagMatch[0]);
				}

				return result;
			},
		},
		{
			name: "reset_board",
			description:
				"Resets the board to a new random initial state. Use this to start over if rotations went wrong. " +
				"After reset, call read_board to see the new state.",
			parameters: {
				type: "object",
				properties: {},
				additionalProperties: false,
			},
			async execute() {
				log.step("Resetowanie planszy...");
				await fetchBoardBuffer(true);
				return "Board reset to a new random state. Call read_board to see it.";
			},
		},
	];
}

// ═══════════════════════════════════════════════════════════════════
// WARSTWA 4: AGENT — LLM autonomicznie rozwiązuje puzzle
// ═══════════════════════════════════════════════════════════════════

const SYSTEM_PROMPT = `You are an autonomous agent solving an electrical cable puzzle on a 3x3 grid.

## Goal
Connect all three power plants to the emergency power source by rotating cable tiles.
- Power SOURCE enters from the LEFT edge of cell 3x1.
- Power PLANTS connect from the RIGHT edge of cells 1x3, 2x3, 3x3.
- You must create continuous cable paths from 3x1 to all three plants.

## How connections work
Each cell has cables exiting through some edges (top, right, bottom, left).
For power to flow between adjacent cells, BOTH cells must have a matching connection:
- Horizontal: left cell needs "right" AND right cell needs "left"
- Vertical: top cell needs "bottom" AND bottom cell needs "top"

## How rotation works
Each rotation = 90° clockwise. Connections transform:
  top → right → bottom → left → top
Example: a cell with [top, right] after 1 rotation becomes [right, bottom].

## Important constraints
- No cable should exit through the TOP edge of row 1 (nothing above the grid).
- No cable should exit through the BOTTOM edge of row 3 (nothing below).
- No cable should exit LEFT except at 3x1 (power source).
- All cells in column 3 must have "right" connection (power plants).
- Cell 3x1 must have "left" connection (power source input).

## Your approach
1. Call read_board to see the current state.
2. For EACH pair of adjacent cells, check if their shared edges match.
3. Figure out which cells need rotation and by how many steps.
4. Execute all rotations.
5. Call read_board again to verify the result.
6. If mismatches remain, analyze and fix them.

Think step by step. Plan all rotations before executing.`;

export default {
	name: "electricity",
	title: "Puzzle elektryczne — połącz elektrownie ze źródłem zasilania",
	season: 2,
	episode: 2,

	async run(ctx) {
		const apiKey = ctx.env.ag3ntsApiKey;
		let flagFound = false;

		const tools = createTools(
			apiKey,
			ctx.log,
			ctx.hub.verify.bind(ctx.hub),
			(flag) => {
				flagFound = true;
				ctx.log.flag({ code: 0, message: flag });
			},
		);

		ctx.log.step("Uruchamianie agenta puzzle elektrycznego");

		const result = await ctx.llm.chat({
			model: "google/gemini-2.5-pro",
			system: SYSTEM_PROMPT,
			messages: [
				{
					role: "user",
					content: "Solve the electricity puzzle. Start by reading the current board state.",
				},
			],
			tools,
			maxIterations: 20,
		});

		ctx.log.step("Agent zakończył pracę");
		ctx.log.info(result.content);

		if (!flagFound) {
			const flagMatch = result.content.match(/\{FLG:[^}]+\}/);
			if (flagMatch) {
				ctx.log.flag({ code: 0, message: flagMatch[0] });
			} else {
				ctx.log.warn("Flaga nie została znaleziona — spróbuj ponownie");
			}
		}
	},
} satisfies TaskDefinition;
