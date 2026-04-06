import type { TaskDefinition } from "@mission/core";

const TASK_NAME = "foodwarehouse";

interface ApiResponse {
	code: number;
	message: string;
	[key: string]: unknown;
}

interface DbRow {
	[key: string]: unknown;
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default {
	name: TASK_NAME,
	title: "S04E05 — Warehouse food distribution for cities",
	season: 4,
	episode: 5,

	async run(ctx) {
		const { hub, log } = ctx;

		const api = async (answer: Record<string, unknown>): Promise<ApiResponse> => {
			for (let attempt = 0; attempt < 5; attempt++) {
				const res = (await hub.verify(TASK_NAME, answer)) as unknown as ApiResponse;
				if (res.code !== -9999) return res;
				const waitSec = 10 * (attempt + 1);
				log.warn(`Rate limited, waiting ${waitSec}s…`);
				await delay(waitSec * 1000);
			}
			throw new Error("Rate limit exceeded after retries");
		};

		const dbQuery = async (query: string): Promise<DbRow[]> => {
			const res = await api({ tool: "database", query });
			return (res.rows as DbRow[]) ?? [];
		};

		// ── 1. Reset state ──
		log.step("Resetting state");
		const resetRes = await api({ tool: "reset" });
		log.info(`Reset: [${resetRes.code}] ${resetRes.message}`);

		// ── 2. Delete seeded orders ──
		log.step("Deleting seeded orders");
		const ordersRes = await api({ tool: "orders", action: "get" });
		const seededOrders = (ordersRes.orders as { id: string }[]) ?? [];
		for (const order of seededOrders) {
			const delRes = await api({ tool: "orders", action: "delete", id: order.id });
			log.detail(`Deleted ${order.id}: [${delRes.code}] ${delRes.message}`);
		}

		// ── 3. Fetch city demands ──
		log.step("Fetching city demands");
		const rawDemands = await hub.fetchData("food4cities.json");
		const demands = JSON.parse(String(rawDemands)) as Record<string, Record<string, number>>;
		const cityNames = Object.keys(demands);
		log.info(`Cities (${cityNames.length}): ${cityNames.join(", ")}`);

		// ── 4. Get destination codes ──
		log.step("Querying destinations");
		const cityList = cityNames.map((c) => `'${c.charAt(0).toUpperCase() + c.slice(1)}'`).join(",");
		const destinations = await dbQuery(
			`SELECT destination_id, name FROM destinations WHERE name IN (${cityList})`,
		);
		const destMap = new Map<string, number>();
		for (const row of destinations) {
			destMap.set(String(row.name).toLowerCase(), Number(row.destination_id));
		}
		log.info(`Destinations: ${JSON.stringify(Object.fromEntries(destMap))}`);

		const missingDest = cityNames.filter((c) => !destMap.has(c));
		if (missingDest.length) {
			log.error(`Missing destinations for: ${missingDest.join(", ")}`);
			return;
		}

		// ── 5. Find transport role user ──
		log.step("Finding transport role user");
		const roles = await dbQuery("SELECT * FROM roles");
		const transportRole = roles.find((r) =>
			String(r.name).toLowerCase().includes("transport"),
		);
		if (!transportRole) {
			log.error(`No transport role found: ${roles.map((r) => `${r.role_id}=${r.name}`).join(", ")}`);
			return;
		}
		log.info(`Transport role: ${transportRole.role_id} = ${transportRole.name}`);

		const users = await dbQuery(
			`SELECT user_id, login, birthday FROM users WHERE is_active = 1 AND role = ${transportRole.role_id} LIMIT 1`,
		);
		const creator = users[0];
		if (!creator) {
			log.error("No active transport user found");
			return;
		}
		const creatorID = Number(creator.user_id);
		const login = String(creator.login);
		const birthday = String(creator.birthday);
		log.info(`Creator: ${login} (ID ${creatorID}, born ${birthday})`);

		// ── 6. Create orders for each city ──
		log.step(`Creating ${cityNames.length} orders`);
		for (const cityName of cityNames) {
			const destination = destMap.get(cityName)!;
			const items = demands[cityName];

			const sigRes = await api({
				tool: "signatureGenerator",
				action: "generate",
				login,
				birthday,
				destination,
			});
			const signature = String(sigRes.hash);

			const createRes = await api({
				tool: "orders",
				action: "create",
				title: `Dostawa dla ${cityName.charAt(0).toUpperCase() + cityName.slice(1)}`,
				creatorID,
				destination,
				signature,
			});

			const order = createRes.order as { id: string } | undefined;
			const orderId = order?.id;
			if (!orderId) {
				log.error(`Failed to create order for ${cityName}: ${JSON.stringify(createRes)}`);
				return;
			}

			const appendRes = await api({
				tool: "orders",
				action: "append",
				id: orderId,
				items,
			});
			log.detail(`${cityName} → ${orderId} [${appendRes.code}]`);

			await delay(1000);
		}

		// ── 7. Verify ──
		log.step("Running final verification");
		const doneRes = await api({ tool: "done" });
		log.info(`Done: [${doneRes.code}] ${doneRes.message}`);

		if (String(doneRes.message).includes("{FLG:")) {
			log.flag({ code: doneRes.code, message: String(doneRes.message) });
		} else {
			log.warn(`No flag — response: ${JSON.stringify(doneRes)}`);
		}
	},
} satisfies TaskDefinition;
