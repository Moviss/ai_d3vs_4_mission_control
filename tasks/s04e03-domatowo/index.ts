import type { TaskDefinition } from "@mission/core";

const TASK_NAME = "domatowo";
const HUB_URL = "https://hub.ag3nts.org/verify";

// B3 (3-story) = tallest blocks. Tiles ordered for efficient round-robin scout assignment:
// each scout gets vertically adjacent pair (row N, row N+1) = 1-field inter-tile move.
const CLUSTERS = [
	{
		name: "top",
		tiles: ["F2", "G2", "F1", "G1"],
		dropoff: "E2",
		passengers: 2,
	},
	{
		name: "bottom-left",
		tiles: ["B10", "A10", "C10", "B11", "A11", "C11"],
		dropoff: "B9",
		passengers: 3,
	},
	{
		name: "bottom-right",
		tiles: ["I10", "H10", "I11", "H11"],
		dropoff: "I9",
		passengers: 2,
	},
];

export default {
	name: TASK_NAME,
	title: "S04E03 — Rescue partisan from Domatowo ruins",
	season: 4,
	episode: 3,

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

		// ── 1. Reset ────────────────────────────────────────────────────────
		log.step("Resetting board");
		await api({ action: "reset" });

		// ── 2. Deploy transporters (sequential to avoid spawn-slot blocking) ─
		log.step("Deploying transporters to B3 clusters");

		const clusterScouts: string[][] = [];

		for (const cluster of CLUSTERS) {
			const createRes = await api({
				action: "create",
				type: "transporter",
				passengers: cluster.passengers,
			});
			const tid = createRes.object as string;
			const scoutIds = (createRes.crew as { id: string }[]).map(
				(c) => c.id,
			);
			log.info(
				`[${cluster.name}] spawned at ${createRes.spawn} (${createRes.action_points_left} pts)`,
			);

			const moveRes = await api({
				action: "move",
				object: tid,
				where: cluster.dropoff,
			});
			log.info(
				`→ ${cluster.dropoff} (${moveRes.path_steps} steps, ${moveRes.action_points_left} pts)`,
			);

			const dismountRes = await api({
				action: "dismount",
				object: tid,
				passengers: cluster.passengers,
			});
			const spawned = dismountRes.spawned as {
				scout: string;
				where: string;
			}[];
			log.info(
				`Scouts at: ${spawned.map((s) => s.where).join(", ")} (${dismountRes.action_points_left} pts)`,
			);

			clusterScouts.push(scoutIds);
		}

		// ── 3. Get all scout positions ──────────────────────────────────────
		const objRes = await api({ action: "getObjects" });
		const objects = objRes.objects as {
			id: string;
			type: string;
			position: string;
		}[];
		const scoutPos = new Map<string, string>();
		for (const o of objects) {
			if (o.type === "scout") scoutPos.set(o.id, o.position);
		}

		// ── 4. Search B3 tiles (callHelicopter as oracle — 0 pts, reliable) ─
		log.step("Searching 14 B3 tiles");

		for (let ci = 0; ci < CLUSTERS.length; ci++) {
			const cluster = CLUSTERS[ci];
			const scouts = clusterScouts[ci];

			for (let ti = 0; ti < cluster.tiles.length; ti++) {
				const tile = cluster.tiles[ti];
				const scoutId = scouts[ti % scouts.length];
				const currentPos = scoutPos.get(scoutId)!;

				if (currentPos !== tile) {
					const moveRes = await api({
						action: "move",
						object: scoutId,
						where: tile,
					});
					scoutPos.set(scoutId, tile);
					log.detail(
						`Scout ${currentPos} → ${tile} (${moveRes.action_points_left} pts)`,
					);
				}

				await api({ action: "inspect", object: scoutId });

				// callHelicopter costs 0 pts — succeeds only after scout confirms human
				const heliRes = await api({
					action: "callHelicopter",
					destination: tile,
				});
				if (
					(heliRes.code as number) > 0 ||
					String(heliRes.message).includes("{FLG:")
				) {
					log.success(`Partisan found at ${tile}!`);
					log.info(`[${heliRes.code}] ${heliRes.message}`);
					if (String(heliRes.message).includes("{FLG:")) {
						log.flag({
							code: heliRes.code as number,
							message: heliRes.message as string,
						});
					}
					return;
				}
				log.detail(`[${tile}] clear`);
			}
		}

		log.error("Partisan not found in any B3 tile!");
		const logsRes = await api({ action: "getLogs" });
		const logs = logsRes.logs as { msg: string; field: string }[];
		for (const l of logs) log.detail(`[${l.field}] ${l.msg}`);
	},
} satisfies TaskDefinition;
