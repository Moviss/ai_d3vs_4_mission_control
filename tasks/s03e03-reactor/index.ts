import type { TaskDefinition } from "@mission/core";

const TASK_NAME = "reactor";
const ROWS = 5;
const COLS = 7;
/** Robot always moves on row 5 (1-indexed) */
const ROBOT_ROW = 5;

interface Block {
	col: number;       // 1-indexed
	top_row: number;   // 1-indexed
	bottom_row: number;// 1-indexed
	direction: "up" | "down";
}

interface ApiResponse {
	code: number;
	message: string;
	board?: string[][];
	player?: { col: number; row: number };
	goal?: { col: number; row: number };
	blocks?: Block[];
	reached_goal?: boolean;
}

/** Does block currently occupy the robot row in given column? */
function blocksRow(block: Block, row: number): boolean {
	return block.top_row <= row && block.bottom_row >= row;
}

/** Predict block position after one step */
function predictBlock(b: Block): { top: number; bottom: number } {
	if (b.direction === "down") {
		if (b.bottom_row >= ROWS) {
			// At bottom boundary → will reverse to up, move up
			return { top: b.top_row - 1, bottom: b.bottom_row - 1 };
		}
		return { top: b.top_row + 1, bottom: b.bottom_row + 1 };
	}
	// direction === "up"
	if (b.top_row <= 1) {
		// At top boundary → will reverse to down, move down
		return { top: b.top_row + 1, bottom: b.bottom_row + 1 };
	}
	return { top: b.top_row - 1, bottom: b.bottom_row - 1 };
}

/** Will column be dangerous at ROBOT_ROW after blocks move? */
function willBeOccupied(blocks: Block[], col: number): boolean {
	for (const b of blocks) {
		if (b.col !== col) continue;
		const next = predictBlock(b);
		if (next.top <= ROBOT_ROW && next.bottom >= ROBOT_ROW) return true;
	}
	return false;
}

/** Is column currently dangerous at ROBOT_ROW? */
function isOccupiedNow(blocks: Block[], col: number): boolean {
	for (const b of blocks) {
		if (b.col !== col) continue;
		if (blocksRow(b, ROBOT_ROW)) return true;
	}
	return false;
}

function formatBoard(board: string[][]): string {
	return board.map((row) => row.join(" ")).join("\n");
}

export default {
	name: TASK_NAME,
	title: "S03E03 — Navigate robot through reactor to install cooling module",
	season: 3,
	episode: 3,

	async run(ctx) {
		const { hub, log } = ctx;

		const sendCommand = async (command: string): Promise<ApiResponse> => {
			log.detail(`> ${command}`);
			const result = (await hub.verify(TASK_NAME, { command })) as ApiResponse;
			return result;
		};

		log.step("Starting reactor navigation");
		let resp = await sendCommand("start");
		log.info(`Board initialized:\n${formatBoard(resp.board!)}`);
		log.info(`Blocks: ${JSON.stringify(resp.blocks)}`);

		const MAX_STEPS = 100;
		let steps = 0;

		while (steps < MAX_STEPS) {
			steps++;

			if (!resp.blocks || !resp.player) {
				log.error(`Missing state data: ${JSON.stringify(resp).slice(0, 500)}`);
				return;
			}

			const playerCol = resp.player.col;
			const blocks = resp.blocks;

			log.process(`Step ${steps}: robot col=${playerCol}, blocks: ${blocks.map((b) => `c${b.col}[${b.top_row}-${b.bottom_row}](${b.direction})`).join(" ")}`);

			// Check if goal reached
			if (resp.reached_goal || playerCol >= COLS) {
				log.success("Robot reached the goal!");
				if (resp.message.includes("{FLG:")) {
					log.flag(resp);
				}
				return;
			}

			// Decide next move
			const nextCol = playerCol + 1;
			const rightSafe = !isOccupiedNow(blocks, nextCol) && !willBeOccupied(blocks, nextCol);
			const currentSafe = !willBeOccupied(blocks, playerCol);

			let command: string;
			if (rightSafe) {
				command = "right";
			} else if (currentSafe) {
				command = "wait";
			} else {
				command = "left";
			}

			log.detail(`rightSafe=${rightSafe}, currentSafe=${currentSafe} → ${command}`);

			resp = await sendCommand(command);

			// Check for flag
			if (resp.message?.includes("{FLG:")) {
				log.flag(resp);
				return;
			}

			// Check for death
			if (resp.code < 0 || resp.message?.toLowerCase().includes("crash") || resp.message?.toLowerCase().includes("zgnieciony") || resp.message?.toLowerCase().includes("destroy")) {
				log.warn(`Robot destroyed: ${resp.message}`);
				log.step("Resetting...");
				await sendCommand("reset");
				resp = await sendCommand("start");
				steps = 0;
				continue;
			}

			if (resp.board) {
				log.detail(`Board:\n${formatBoard(resp.board)}`);
			}
		}

		log.error(`Failed to reach goal in ${MAX_STEPS} steps`);
	},
} satisfies TaskDefinition;
