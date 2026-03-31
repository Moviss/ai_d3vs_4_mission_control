import type { TaskDefinition } from "@mission/core";

const TASK_NAME = "windpower";
const HUB_URL = "https://hub.ag3nts.org/verify";

// Turbine specs from documentation
const CUTOFF_WIND_MS = 14; // above this = storm, blades break
const MIN_WIND_MS = 4; // below this = no generation
const RATED_POWER_KW = 14;

// Wind → yield curve (linear interpolation between known points)
const WIND_CURVE: [number, number][] = [
	[0, 0],
	[4, 0.125], // 10-15% avg
	[6, 0.35], // 30-40% avg
	[8, 0.65], // 60-70% avg
	[10, 0.95], // 90-100% avg
	[12, 1.0],
	[14, 1.0],
];

function interpolateWindYield(windMs: number): number {
	if (windMs <= 0) return 0;
	if (windMs > CUTOFF_WIND_MS) return 0;
	for (let i = 1; i < WIND_CURVE.length; i++) {
		const [w0, y0] = WIND_CURVE[i - 1];
		const [w1, y1] = WIND_CURVE[i];
		if (windMs <= w1) {
			const t = (windMs - w0) / (w1 - w0);
			return y0 + t * (y1 - y0);
		}
	}
	return 1.0;
}

function estimatedPower(windMs: number, pitchAngle: number): number {
	const windYield = interpolateWindYield(windMs);
	const pitchYield = pitchAngle === 0 ? 1.0 : pitchAngle === 45 ? 0.65 : 0.0;
	return RATED_POWER_KW * windYield * pitchYield;
}

function parseDeficit(raw: string): { min: number; max: number } {
	const parts = raw.split("-").map(Number);
	return parts.length === 2
		? { min: parts[0], max: parts[1] }
		: { min: parts[0], max: parts[0] };
}

interface WeatherEntry {
	timestamp: string;
	windMs: number;
}

interface ConfigPoint {
	timestamp: string; // "YYYY-MM-DD HH:00:00"
	date: string;
	hour: string;
	pitchAngle: number;
	turbineMode: "production" | "idle";
	windMs: number;
	unlockCode?: string;
}

export default {
	name: TASK_NAME,
	title: "S04E02 — Configure wind turbine for power production",
	season: 4,
	episode: 2,

	async run(ctx) {
		const { env, log } = ctx;
		const apikey = env.ag3ntsApiKey;

		const api = async (answer: Record<string, unknown>) => {
			const res = await fetch(HUB_URL, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ apikey, task: TASK_NAME, answer }),
			});
			return res.json() as Promise<Record<string, unknown>>;
		};

		// Poll until `count` results with sourceFunction arrive or timeout
		const pollResults = async (
			count: number,
			label: string,
			timeoutMs = 28000,
		): Promise<Record<string, unknown>[]> => {
			const collected: Record<string, unknown>[] = [];
			const deadline = Date.now() + timeoutMs;
			while (collected.length < count && Date.now() < deadline) {
				const res = await api({ action: "getResult" });
				if (res.sourceFunction) {
					collected.push(res);
					log.detail(
						`  got [${res.sourceFunction}] (${collected.length}/${count})`,
					);
				} else {
					await new Promise((r) => setTimeout(r, 400));
				}
			}
			if (collected.length < count) {
				log.warn(
					`Timeout waiting for ${label}: got ${collected.length}/${count}`,
				);
			}
			return collected;
		};

		// ── 1. Start service window ──────────────────────────────────────────
		log.step("Starting service window");
		const startRes = await api({ action: "start" });
		const T0 = Date.now();
		log.info(`Session started — timeout ${startRes.sessionTimeout}s`);

		// ── 2. Queue weather + powerplantcheck in parallel ───────────────────
		log.step("Queueing weather + powerplantcheck");
		await Promise.all([
			api({ action: "get", param: "weather" }),
			api({ action: "get", param: "powerplantcheck" }),
		]);

		// ── 3. Collect both async results ────────────────────────────────────
		log.step("Polling for data…");
		const dataResults = await pollResults(2, "weather+powerplant");
		log.info(`Data in ${elapsed(T0)}s`);

		let forecast: WeatherEntry[] = [];
		let powerDeficitKw = "";

		for (const r of dataResults) {
			if (r.sourceFunction === "weather") {
				forecast = (r.forecast as WeatherEntry[]) ?? [];
			} else if (r.sourceFunction === "powerplantcheck") {
				powerDeficitKw = String(r.powerDeficitKw ?? "");
			}
		}

		log.info(`Forecast: ${forecast.length} entries | Deficit: ${powerDeficitKw} kW`);

		if (!forecast.length || !powerDeficitKw) {
			log.error(
				`Missing data — forecast=${forecast.length} deficit="${powerDeficitKw}"`,
			);
			return;
		}

		// ── 4. Analyse weather ───────────────────────────────────────────────
		const deficit = parseDeficit(powerDeficitKw);

		// Show all usable wind windows for debugging
		const usable = forecast.filter(
			(f) => f.windMs >= MIN_WIND_MS && f.windMs <= CUTOFF_WIND_MS,
		);
		log.detail(
			`Usable wind slots: ${usable.map((f) => `${f.timestamp.slice(5, 16)} ${f.windMs}m/s → ${estimatedPower(f.windMs, 0).toFixed(1)}kW`).join(", ")}`,
		);

		// Storms = wind above cutoff
		const storms = forecast.filter((f) => f.windMs > CUTOFF_WIND_MS);
		log.info(
			`Storms (${storms.length}): ${storms.map((s) => `${s.timestamp.slice(5, 16)} ${s.windMs}m/s`).join(", ")}`,
		);

		// First slot where turbine can meet the minimum deficit at pitch 0°
		const productionSlot = forecast.find((f) => {
			if (f.windMs > CUTOFF_WIND_MS || f.windMs < MIN_WIND_MS) return false;
			return estimatedPower(f.windMs, 0) >= deficit.min;
		});

		if (!productionSlot) {
			log.error(
				`No production slot found for deficit ≥${deficit.min} kW among ${usable.length} usable slots`,
			);
			return;
		}

		const prodPower = estimatedPower(productionSlot.windMs, 0);
		log.info(
			`Production slot: ${productionSlot.timestamp} — ${productionSlot.windMs}m/s → ~${prodPower.toFixed(1)} kW`,
		);

		// ── 5. Build config points ───────────────────────────────────────────
		const configPoints: ConfigPoint[] = [];

		// One protection config per storm
		for (const s of storms) {
			const [date, hour] = s.timestamp.split(" ");
			configPoints.push({
				timestamp: s.timestamp,
				date,
				hour,
				pitchAngle: 90,
				turbineMode: "idle",
				windMs: s.windMs,
			});
		}

		// Production
		const [prodDate, prodHour] = productionSlot.timestamp.split(" ");
		configPoints.push({
			timestamp: productionSlot.timestamp,
			date: prodDate,
			hour: prodHour,
			pitchAngle: 0,
			turbineMode: "production",
			windMs: productionSlot.windMs,
		});

		log.info(
			`Config points (${configPoints.length}): ${configPoints.map((c) => `${c.timestamp.slice(5, 16)} ${c.turbineMode}`).join(", ")}`,
		);

		// ── 6. Generate all unlock codes in parallel ─────────────────────────
		log.step(`Generating ${configPoints.length} unlock codes`);
		await Promise.all(
			configPoints.map((cp) =>
				api({
					action: "unlockCodeGenerator",
					startDate: cp.date,
					startHour: cp.hour,
					windMs: cp.windMs,
					pitchAngle: cp.pitchAngle,
				}),
			),
		);

		// ── 7. Collect unlock codes ──────────────────────────────────────────
		log.step("Polling for unlock codes…");
		const codeResults = await pollResults(configPoints.length, "unlock codes");
		log.info(`Codes in ${elapsed(T0)}s`);

		for (const r of codeResults) {
			const params = r.signedParams as Record<string, string> | undefined;
			const key = params
				? `${params.startDate} ${params.startHour}`
				: `${r.startDate} ${r.startHour}`;
			const point = configPoints.find((cp) => cp.timestamp === key);
			if (point) {
				point.unlockCode = r.unlockCode as string;
			} else {
				log.warn(`Unlock code for unknown slot "${key}"`);
			}
		}

		const missing = configPoints.filter((cp) => !cp.unlockCode);
		if (missing.length) {
			log.error(
				`Missing codes for: ${missing.map((m) => m.timestamp).join(", ")}`,
			);
			return;
		}

		// ── 8. Send batch config ─────────────────────────────────────────────
		log.step("Sending batch configuration");
		const configs: Record<
			string,
			{ pitchAngle: number; turbineMode: string; unlockCode: string }
		> = {};
		for (const cp of configPoints) {
			configs[cp.timestamp] = {
				pitchAngle: cp.pitchAngle,
				turbineMode: cp.turbineMode,
				// biome-ignore lint/style/noNonNullAssertion: checked above
				unlockCode: cp.unlockCode!,
			};
		}
		const configRes = await api({ action: "config", configs });
		log.info(`Config: [${configRes.code}] ${configRes.message}`);

		// ── 9. Turbine check (required before done) ──────────────────────────
		log.step("Queuing turbine check");
		await api({ action: "get", param: "turbinecheck" });
		const checkRes = await pollResults(1, "turbinecheck");
		log.info(
			`Turbine check [${checkRes[0]?.code}] ${checkRes[0]?.message} — ${elapsed(T0)}s elapsed`,
		);

		// ── 10. Final done ───────────────────────────────────────────────────
		log.step("Sending done");
		const doneRes = await api({ action: "done" });
		log.info(`Done response: [${doneRes.code}] ${doneRes.message}`);

		if (String(doneRes.message).includes("{FLG:")) {
			log.flag({
				code: doneRes.code as number,
				message: doneRes.message as string,
			});
		} else {
			log.warn(`No flag — full response: ${JSON.stringify(doneRes)}`);
		}
	},
} satisfies TaskDefinition;

function elapsed(t0: number) {
	return ((Date.now() - t0) / 1000).toFixed(1);
}
