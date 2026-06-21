import { createHash } from "node:crypto";
import type { TaskDefinition } from "@mission/core";

const TASK_NAME = "goingthere";
const SCANNER_URL = "https://hub.ag3nts.org/api/frequencyScanner";
const MAX_GAMES = 40;

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default {
	name: TASK_NAME,
	title: "S05E04 — Navigate rocket to Grudziądz avoiding rocks and OKO radars",
	season: 5,
	episode: 4,

	async run(ctx) {
		const { hub, llm, log } = ctx;
		const apikey = ctx.env.ag3ntsApiKey;

		// ── Scanner: parse garbled radar response ──

		function parseScanner(raw: string): {
			frequency: number;
			detectionCode: string;
		} | null {
			// Strategy 1: extract JSON object and parse, matching keys fuzzily
			const jsonMatch = raw.match(/\{[\s\S]*?\}/);
			if (jsonMatch) {
				try {
					const obj = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
					let freq: number | undefined;
					let code: string | undefined;
					for (const [k, v] of Object.entries(obj)) {
						if (/freq/i.test(k)) freq = Number(v);
						if (/code/i.test(k) && typeof v === "string") code = v;
					}
					if (freq && code) return { frequency: freq, detectionCode: code };
				} catch {}
			}

			// Strategy 2: regex extraction for frequency
			const freqPatterns = [/frequency["'\s:=`]+\s*(\d+)/i, /fr\w*["'\s:=`]+\s*(\d+)/i];
			let freq: number | undefined;
			for (const p of freqPatterns) {
				const m = raw.match(p);
				if (m) {
					freq = Number(m[1]);
					break;
				}
			}

			// Strategy 3: regex extraction for detectionCode
			const codePatterns = [
				/detectionCode["'\s:=`]+\s*['"]?([a-zA-Z0-9]{4,})['"]?/i,
				/detect\w*code["'\s:=`]+\s*['"]?([a-zA-Z0-9]{4,})['"]?/i,
				/d\w*t\w*ct\w*c\w*d\w*["'\s:=`]+\s*['"]?([a-zA-Z0-9]{4,})['"]?/i,
				/code["'\s:=`]+\s*['"]?([a-zA-Z0-9]{6,})['"]?/i,
			];
			let code: string | undefined;
			for (const p of codePatterns) {
				const m = raw.match(p);
				if (m) {
					code = m[1];
					break;
				}
			}

			if (freq && code) return { frequency: freq, detectionCode: code };
			return null;
		}

		async function fetchScannerRaw(): Promise<string | null> {
			try {
				const r = await fetch(`${SCANNER_URL}?key=${apikey}`);
				return r.ok ? await r.text() : null;
			} catch {
				return null;
			}
		}

		async function checkScanner(): Promise<"clear" | { frequency: number; detectionCode: string }> {
			// Get a non-null scanner response (retry only on null/network error)
			for (let i = 0; i < 3; i++) {
				const raw = await fetchScannerRaw();
				if (!raw) {
					await delay(400);
					continue;
				}

				log.detail(`Scanner: ${raw.slice(0, 200)}`);

				const hasTracking = /freq|detect|track|lock|weapon|code/i.test(raw);
				const isStrictClear = raw.length < 60 && /cle+a+r/i.test(raw) && !hasTracking;

				if (isStrictClear) return "clear";

				if (hasTracking) {
					// Try regex parse
					const parsed = parseScanner(raw);
					if (parsed) return parsed;

					// Regex failed — garbled data won't improve on retry. Go straight to LLM.
					try {
						const { data } = await llm.structured<{
							frequency: number;
							detectionCode: string;
						}>({
							model: "openai/gpt-4.1-nano",
							system:
								"Extract frequency (number) and detectionCode (alphanumeric string) from garbled radar text. Field names may use leet speak (3=e, 0=o, 1=i, b=d). Return exact values, do not modify them.",
							user: raw,
							schema: {
								type: "object",
								properties: {
									frequency: { type: "number" },
									detectionCode: { type: "string" },
								},
								required: ["frequency", "detectionCode"],
								additionalProperties: false,
							},
						});
						if (data.frequency && data.detectionCode) return data;
					} catch {}
				}

				await delay(300);
			}

			throw new Error("Scanner failed after all attempts");
		}

		async function disarmTrap(freq: number, code: string): Promise<void> {
			const hash = createHash("sha1").update(`${code}disarm`).digest("hex");
			log.detail(`Disarm: freq=${freq} code=${code} → hash=${hash}`);
			for (let i = 0; i < 5; i++) {
				try {
					const res = await hub.post("api/frequencyScanner", {
						frequency: freq,
						disarmHash: hash,
					});
					log.detail(`Disarm result: ${JSON.stringify(res)}`);
					return;
				} catch (err) {
					log.warn(`Disarm attempt ${i + 1} failed: ${err}`);
					await delay(1000);
				}
			}
			throw new Error("Disarm failed after 5 attempts");
		}

		// ── Hint: get and classify ──

		async function getHint(): Promise<string> {
			for (let i = 0; i < 8; i++) {
				try {
					const res = (await hub.post("api/getmessage", {})) as Record<string, unknown>;
					log.detail(`getmessage response: ${JSON.stringify(res)}`);
					const text = String(res.hint ?? res.message ?? "");
					if (/too.many|rate.limit|za\s+cz/i.test(text)) {
						await delay(3000);
						continue;
					}
					if (/crash|no\s+active/i.test(text)) throw new Error("Game over");
					if (text) return text;
				} catch (err) {
					if ((err as Error).message === "Game over") throw err;
				}
				await delay(1500);
			}
			throw new Error("Hint failed after 8 attempts");
		}

		async function classifyRock(hint: string): Promise<"left" | "right" | "ahead"> {
			const { data } = await llm.structured<{
				leftAnalysis: string;
				aheadAnalysis: string;
				rightAnalysis: string;
				rockPosition: "left" | "right" | "ahead";
			}>({
				model: "anthropic/claude-sonnet-4.6",
				system: `You navigate a rocket on a 3-row grid. A radio message describes where a ROCK is in the next column relative to the rocket. Analyze each direction then determine which has the rock.

DIRECTIONS:
- "left" = rock is ABOVE the rocket (upper row, port side)
- "right" = rock is BELOW the rocket (lower row, starboard side)
- "ahead" = rock is in the SAME row as the rocket (directly forward, bow)

NAUTICAL TERMS → DIRECTION:
- "port", "port side", "port flank", "port bow", "port hull" → LEFT
- "starboard", "starboard side", "starboard flank", "starboard bow" → RIGHT
- "bow", "dead ahead", "nose", "forward", "center", "heading", "current line", "in front", "before you", "before the nose" → AHEAD

CRITICAL INTERPRETATION RULES:
1. "right in front" / "right before you" / "right ahead" / "squarely in front" = DIRECTLY/EXACTLY ahead → AHEAD (the word "right" here means "exactly", NOT the starboard direction!)
2. "opposite port" / "opposite of port" = starboard → RIGHT
3. If the message says two sides are SAFE/CLEAR/OPEN/USABLE, the rock is on the remaining THIRD side that was NOT mentioned as safe.
   Example: "port and bow are clear" → rock is at starboard → RIGHT
   Example: "ahead and starboard both look usable" → rock is at port → LEFT
4. Focus on where the OBSTACLE/ROCK/DANGER is, not the safe passages.
5. Messages may use colorful, nautical, or unusual phrasing — extract the directional meaning.

For each direction, state what the hint says about it (safe, dangerous, or not mentioned).`,
				user: hint,
				schema: {
					type: "object",
					properties: {
						leftAnalysis: { type: "string" },
						aheadAnalysis: { type: "string" },
						rightAnalysis: { type: "string" },
						rockPosition: {
							type: "string",
							enum: ["left", "right", "ahead"],
						},
					},
					required: ["leftAnalysis", "aheadAnalysis", "rightAnalysis", "rockPosition"],
					additionalProperties: false,
				},
			});
			log.detail(
				`Hint reasoning: L=${data.leftAnalysis} A=${data.aheadAnalysis} R=${data.rightAnalysis} → ${data.rockPosition}`,
			);
			return data.rockPosition;
		}

		// ── Deterministic movement with bounds enforcement ──
		// Grid: rows 1-3, columns 1-12. left=row-1, right=row+1, go=same row.
		// Each column has exactly one rock. We avoid the rock AND stay in bounds.

		function pickCommand(
			rock: "left" | "right" | "ahead",
			row: number,
			targetRow: number,
			step: number,
		): "go" | "left" | "right" {
			const canGo = rock !== "ahead";
			const canLeft = rock !== "left" && row > 1;
			const canRight = rock !== "right" && row < 3;

			// When hint=ahead at row 2 (both sides open), alternate direction.
			// Hints are sometimes wrong — always picking the same side causes
			// systematic crashes toward the target row.
			if (rock === "ahead" && canLeft && canRight) {
				return step % 2 === 0 ? "left" : "right";
			}

			// Standard priority: move toward target row > go straight > any safe move
			if (row > targetRow && canLeft) return "left";
			if (row < targetRow && canRight) return "right";
			if (canGo) return "go";
			if (canLeft) return "left";
			if (canRight) return "right";

			return "go";
		}

		// ── Main game loop ──

		let bestMoves = 0;

		for (let game = 0; game < MAX_GAMES; game++) {
			if (game > 0) await delay(2000);

			log.info(`\n═══ Game ${game + 1} ═══`);

			let startRes: Record<string, unknown>;
			try {
				startRes = (await hub.verify(TASK_NAME, {
					command: "start",
				})) as Record<string, unknown>;
			} catch (err) {
				log.warn(`Start failed: ${err}`);
				continue;
			}

			log.info(`Start response: ${JSON.stringify(startRes)}`);

			let targetRow = 2;
			const base = startRes.base as Record<string, number> | undefined;
			if (base?.row) targetRow = base.row;

			let row = 2;
			let col = 1;
			let crashed = false;
			let movesDone = 0;
			let prevColStone: number | undefined;

			// Extract col 1 stone from start response for off-by-one diagnosis
			const startCol = startRes.currentColumn as Record<string, number> | undefined;
			if (startCol?.stoneRow) {
				prevColStone = startCol.stoneRow;
				const col1Dir =
					startCol.stoneRow < row ? "left" : startCol.stoneRow > row ? "right" : "ahead";
				log.info(
					`Col 1 stone: row ${startCol.stoneRow} → "${col1Dir}" relative to rocket at row ${row}`,
				);
			}

			log.info(`Rocket at (row=${row}, col=${col}) → target row ${targetRow}`);

			for (let step = 0; step < 11; step++) {
				// 1. Scanner check — detect and disarm OKO radar
				await delay(100);
				try {
					const scan = await checkScanner();
					if (scan !== "clear") {
						log.process(`[G${game + 1}] Radar at col ${col}! freq=${scan.frequency} — disarming`);
						await disarmTrap(scan.frequency, scan.detectionCode);
					}
				} catch (err) {
					log.warn(`Scanner error at col ${col}: ${err}`);
				}

				// 2. Get radio hint about rock in next column
				await delay(200);
				let hint: string;
				try {
					hint = await getHint();
				} catch {
					crashed = true;
					log.error("Game over (hint fetch indicates crash)");
					break;
				}

				// 3. Classify rock position via LLM
				const rock = await classifyRock(hint);

				// 4. Pick movement command deterministically (enforces bounds)
				const command = pickCommand(rock, row, targetRow, step);

				log.info(
					`[G${game + 1}] Step ${step + 1}: (${row},${col}) hint="${hint.slice(0, 80)}" rock=${rock} → ${command}`,
				);

				// 5. Execute move — do NOT retry (avoid double-move state divergence)
				let res: Record<string, unknown>;
				try {
					res = (await hub.verify(TASK_NAME, {
						command,
					})) as Record<string, unknown>;
				} catch (err) {
					crashed = true;
					log.error(`Move command failed: ${err}`);
					break;
				}

				// Update tracked position
				if (command === "left") row--;
				else if (command === "right") row++;
				col++;
				movesDone++;

				const fullRes = JSON.stringify(res);
				log.info(`Move result: ${fullRes.slice(0, 400)}`);

				// Check for flag anywhere in response
				if (fullRes.includes("{FLG:")) {
					log.flag({ code: res.code, message: fullRes });
					return;
				}

				// Check for crash
				const msg = String(res.message ?? "");
				if (/crash|destroy|shot|kill|dead|game.over|hit|explod|missile|rozbij/i.test(msg)) {
					const reason = /missile|shot|kill|radar/i.test(msg) ? "MISSILE" : "ROCK";
					log.warn(
						`[G${game + 1}] ${reason} crash at step ${movesDone}: hint="${hint.slice(0, 80)}" rock=${rock} cmd=${command} pos=(${row},${col})`,
					);
					crashed = true;
					break;
				}

				// ── Position verification: correct tracking from game response ──
				const player = res.player as Record<string, number> | undefined;
				if (player?.row != null && player?.col != null) {
					if (player.row !== row || player.col !== col) {
						log.warn(
							`POSITION DRIFT! tracked=(${row},${col}) actual=(${player.row},${player.col}) — correcting`,
						);
						row = player.row;
						col = player.col;
					}
				}

				// ── Off-by-one diagnosis + hint verification ──
				const cc = res.currentColumn as Record<string, number> | undefined;
				if (cc?.stoneRow) {
					const prevRow = command === "left" ? row + 1 : command === "right" ? row - 1 : row;
					const actualDir =
						cc.stoneRow < prevRow ? "left" : cc.stoneRow > prevRow ? "right" : "ahead";
					const hintMatch = rock === actualDir;

					// Check if hint matches PREVIOUS column instead (off-by-one)
					let offByOne = false;
					if (!hintMatch && prevColStone !== undefined) {
						const prevColDir =
							prevColStone < prevRow ? "left" : prevColStone > prevRow ? "right" : "ahead";
						if (rock === prevColDir) offByOne = true;
					}

					if (hintMatch) {
						log.info(
							`[G${game + 1}] Verify OK: stone@row${cc.stoneRow} from@row${prevRow} hint=${rock}`,
						);
					} else if (offByOne) {
						log.warn(
							`[G${game + 1}] OFF-BY-ONE! hint=${rock} matches prev col stone@row${prevColStone}, NOT current stone@row${cc.stoneRow}`,
						);
					} else {
						log.warn(
							`[G${game + 1}] MISMATCH! hint=${rock} actual=${actualDir} stone@row${cc.stoneRow} from@row${prevRow}`,
						);
					}

					prevColStone = cc.stoneRow;
				}
			}

			if (movesDone > bestMoves) bestMoves = movesDone;

			if (!crashed) {
				log.info(`[G${game + 1}] All 11 moves done! pos=(${row},${col}) target=${targetRow}`);
			}
		}

		log.error(`Failed after ${MAX_GAMES} games (best run: ${bestMoves} moves)`);
	},
} satisfies TaskDefinition;
