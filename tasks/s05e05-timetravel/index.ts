import { createInterface } from "node:readline/promises";
import type { TaskDefinition } from "@mission/core";

const TASK_NAME = "timetravel";
const HUB_URL = "https://hub.ag3nts.org/verify";

const PWR: Record<number, number> = { 2024: 19, 2026: 28, 2238: 91 };

function calcSyncRatio(day: number, month: number, year: number): number {
	const raw = (day * 8 + month * 12 + year * 7) % 101;
	return Number((raw / 100).toFixed(2));
}

function targetMode(year: number): number {
	if (year < 2000) return 1;
	if (year <= 2150) return 2;
	if (year <= 2300) return 3;
	return 4;
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

interface DeviceConfig {
	day: number | null;
	month: number | null;
	year: number | null;
	syncRatio: number;
	stabilization: number;
	condition: string;
	fluxDensity: number;
	batteryStatus: string;
	PTA: boolean;
	PTB: boolean;
	PWR: number;
	mode: string;
	internalMode: number;
}

export default {
	name: TASK_NAME,
	title: "S05E05 — Time travel to rescue Rafal",
	season: 5,
	episode: 5,

	async run(ctx) {
		const { log, llm } = ctx;
		const apikey = ctx.env.ag3ntsApiKey;

		const api = async (
			answer: Record<string, unknown>,
		): Promise<Record<string, unknown>> => {
			const res = await fetch(HUB_URL, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ apikey, task: TASK_NAME, answer }),
			});
			return res.json() as Promise<Record<string, unknown>>;
		};

		const cfg = (res: Record<string, unknown>): DeviceConfig | null =>
			(res.config as DeviceConfig) ?? null;

		const hasFlag = (res: Record<string, unknown>): boolean => {
			const s = JSON.stringify(res);
			if (s.includes("{FLG:")) {
				log.flag({ code: (res.code as number) ?? 0, message: s });
				return true;
			}
			return false;
		};

		const rl = createInterface({
			input: process.stdin,
			output: process.stdout,
		});
		const prompt = (msg: string) => rl.question(`\n >> ${msg} `);

		const printConfig = (c: DeviceConfig) => {
			log.info(
				`  day=${c.day} month=${c.month} year=${c.year} sync=${c.syncRatio} stab=${c.stabilization}`,
			);
			log.info(
				`  flux=${c.fluxDensity}% mode=${c.mode} iMode=${c.internalMode} cond=${c.condition}`,
			);
			log.info(
				`  PTA=${c.PTA} PTB=${c.PTB} PWR=${c.PWR} battery=${c.batteryStatus}`,
			);
		};

		const jumps = [
			{
				label: "Jump 1: To Nov 5, 2238 (get batteries)",
				day: 5,
				month: 11,
				year: 2238,
				ptA: false,
				ptB: true,
				tunnel: false,
			},
			{
				label: "Jump 2: Return to Apr 11, 2026 (today)",
				day: 11,
				month: 4,
				year: 2026,
				ptA: true,
				ptB: false,
				tunnel: false,
			},
			{
				label: "Jump 3: Tunnel to Nov 12, 2024 (rescue Rafal)",
				day: 12,
				month: 11,
				year: 2024,
				ptA: true,
				ptB: true,
				tunnel: true,
			},
		];

		try {
			log.step("Calling help");
			const help = await api({ action: "help" });
			log.info(JSON.stringify(help, null, 2));

			log.step("Resetting device (initial)");
			let res = await api({ action: "reset" });
			log.info(JSON.stringify(res));
			const initCfg = cfg(res);
			if (initCfg)
				log.info(`Initial battery: ${initCfg.batteryStatus}`);

			for (let i = 0; i < jumps.length; i++) {
				const j = jumps[i];
				const sr = calcSyncRatio(j.day, j.month, j.year);
				const mode = targetMode(j.year);
				const pwr = PWR[j.year] ?? 50;

				log.step(`=== ${j.label} ===`);
				log.info(
					`Calculated: syncRatio=${sr}, internalMode=${mode}, PWR=${pwr}`,
				);

				// Ensure device is in standby before configuring
				let standbyOk = false;
				while (!standbyOk) {
					res = await api({ action: "getConfig" });
					const cur = cfg(res);
					if (cur?.mode === "standby") {
						log.info(
							`Device in standby, battery=${cur.batteryStatus}`,
						);
						standbyOk = true;
					} else {
						log.warn(
							`Device mode: ${cur?.mode ?? "unknown"} — need standby`,
						);
						await prompt(
							"Switch to STANDBY in web interface, then [Enter]",
						);
					}
				}

				// Configure date + syncRatio via API
				let needConfigHint = "";
				for (const [p, v] of [
					["year", j.year],
					["month", j.month],
					["day", j.day],
					["syncRatio", sr],
				] as [string, number][]) {
					res = await api({
						action: "configure",
						param: p,
						value: v,
					});
					const resCfg = cfg(res);
					log.info(
						`${p}=${v}: [${res.code}] ${res.message}`,
					);
					if (res.needConfig)
						needConfigHint = String(res.needConfig);
					if (hasFlag(res)) return;
					// Verify the param was actually set
					if (
						resCfg &&
						resCfg[p as keyof DeviceConfig] !== v
					) {
						log.error(
							`FAILED to set ${p}=${v} — device shows ${resCfg[p as keyof DeviceConfig]}`,
						);
					}
				}

				// Parse stabilization from needConfig hint using LLM
				log.step("Resolving stabilization");
				if (needConfigHint) {
					log.info(`needConfig hint: ${needConfigHint}`);
					const { data } = await llm.structured<{
						reasoning: string;
						value: number;
					}>({
						model: "openai/gpt-4.1-mini",
						system:
							"You receive a Polish-language hint about a stabilization parameter for a time machine. " +
							"The hint describes a base number and an adjustment (subtraction/addition). " +
							"Extract the numbers (written as Polish words), perform the calculation, and return the final integer value. " +
							"Examples: 'dziewięćset' = 900, 'siedemset jedenaście' = 711, 'trzysta czterdzieści pięć' = 345.",
						user: needConfigHint,
						schema: {
							type: "object",
							properties: {
								reasoning: {
									type: "string",
									description:
										"Show the numbers found and the calculation",
								},
								value: {
									type: "integer",
									description:
										"The final stabilization value",
								},
							},
							required: ["reasoning", "value"],
							additionalProperties: false,
						},
					});
					log.info(`LLM reasoning: ${data.reasoning}`);
					log.info(`Stabilization value: ${data.value}`);

					const stabRes = await api({
						action: "configure",
						param: "stabilization",
						value: data.value,
					});
					log.info(
						`stabilization=${data.value}: [${stabRes.code}] ${stabRes.message}`,
					);
					const stabCfg = cfg(stabRes);
					if (stabCfg)
						log.info(
							`condition=${stabCfg.condition} flux=${stabCfg.fluxDensity}%`,
						);
					if (hasFlag(stabRes)) return;
				} else {
					log.warn("No needConfig hint received");
					const input = await prompt(
						"Enter stabilization value: ",
					);
					if (input.trim()) {
						const stabRes = await api({
							action: "configure",
							param: "stabilization",
							value: Number(input),
						});
						log.info(
							`stabilization=${input}: [${stabRes.code}] ${stabRes.message}`,
						);
						if (hasFlag(stabRes)) return;
					}
				}

				// Web interface instructions
				log.step("--- SET IN WEB INTERFACE ---");
				log.info(`PT-A: ${j.ptA ? "ON" : "OFF"}`);
				log.info(`PT-B: ${j.ptB ? "ON" : "OFF"}`);
				log.info(`PWR: ${pwr}`);
				log.info("Keep device in STANDBY for now!");
				if (j.tunnel)
					log.warn("TUNNEL MODE: both PT-A and PT-B must be ON");

				await prompt("Set PT-A/PT-B/PWR as shown, then [Enter]");

				// Verify config
				log.step("Verifying configuration");
				res = await api({ action: "getConfig" });
				const c = cfg(res);
				if (c) {
					printConfig(c);
					if (c.fluxDensity < 100)
						log.warn(
							`Flux density: ${c.fluxDensity}% (need 100% — internalMode will add the rest)`,
						);
				}

				// Poll for correct internalMode + flux=100%
				log.step(
					`Waiting for internalMode=${mode} with flux=100%`,
				);
				let jumpReady = false;
				for (let p = 0; p < 60; p++) {
					res = await api({ action: "getConfig" });
					const s = cfg(res);
					if (!s) {
						await wait(2000);
						continue;
					}

					log.detail(
						`[${p + 1}] mode=${s.internalMode} flux=${s.fluxDensity}% cond=${s.condition} bat=${s.batteryStatus}`,
					);

					if (
						s.internalMode === mode &&
						s.fluxDensity === 100
					) {
						log.success(
							`internalMode=${mode}, flux=100%, condition=${s.condition} — GO!`,
						);
						jumpReady = true;
						break;
					}
					await wait(2000);
				}

				if (!jumpReady)
					log.error(
						"Timeout — check config in web interface",
					);

				await prompt(
					"Switch to ACTIVE, click the SPHERE, then [Enter]",
				);

				await wait(1500);
				res = await api({ action: "getConfig" });
				log.info(`Post-jump: ${JSON.stringify(res)}`);
				if (hasFlag(res)) return;

				// Between jumps: do NOT reset — it wipes the battery
				if (i < jumps.length - 1) {
					const postCfg = cfg(res);
					if (postCfg)
						log.info(
							`Battery: ${postCfg.batteryStatus} — DO NOT RESET (preserves battery)`,
						);
					await prompt(
						"Switch device back to STANDBY in web interface, then [Enter]",
					);
				}
			}

			log.warn("All jumps completed — check above for flag");
		} finally {
			rl.close();
		}
	},
} satisfies TaskDefinition;
