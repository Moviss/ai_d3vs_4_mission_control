import type { TaskDefinition } from "@mission/core";

const TASK_NAME = "savethem";
const BASE_URL = "https://hub.ag3nts.org/api";

type Tile = "." | "W" | "T" | "R" | "S" | "G";
type Direction = "up" | "down" | "left" | "right";
type Vehicle = "rocket" | "car" | "horse" | "walk";

interface VehicleInfo {
	name: Vehicle;
	fuel: number;
	food: number;
	canCrossWater: boolean;
}

interface State {
	row: number;
	col: number;
	fuel: number;
	food: number;
	mode: Vehicle;
	dismounted: boolean;
	path: string[];
}

const VEHICLES: Record<Vehicle, VehicleInfo> = {
	rocket: { name: "rocket", fuel: 1.0, food: 0.1, canCrossWater: false },
	car: { name: "car", fuel: 0.7, food: 1.0, canCrossWater: false },
	horse: { name: "horse", fuel: 0, food: 1.6, canCrossWater: true },
	walk: { name: "walk", fuel: 0, food: 2.5, canCrossWater: true },
};

const TREE_FUEL_PENALTY = 0.2;
const MAX_FUEL = 10;
const MAX_FOOD = 10;

const DIRS: { dir: Direction; dr: number; dc: number }[] = [
	{ dir: "up", dr: -1, dc: 0 },
	{ dir: "down", dr: 1, dc: 0 },
	{ dir: "left", dr: 0, dc: -1 },
	{ dir: "right", dr: 0, dc: 1 },
];

function findOptimalPath(map: Tile[][]): string[] | null {
	const rows = map.length;
	const cols = map[0].length;

	let startR = -1;
	let startC = -1;
	let goalR = -1;
	let goalC = -1;

	for (let r = 0; r < rows; r++) {
		for (let c = 0; c < cols; c++) {
			if (map[r][c] === "S") {
				startR = r;
				startC = c;
			}
			if (map[r][c] === "G") {
				goalR = r;
				goalC = c;
			}
		}
	}

	if (startR < 0 || goalR < 0) return null;

	const startVehicles: Vehicle[] = ["rocket", "car", "horse", "walk"];

	// BFS with state: (row, col, fuel*10, food*10, mode, dismounted)
	// Discretize fuel/food to 0.1 units for state tracking
	const quantize = (v: number) => Math.round(v * 10);
	const stateKey = (s: State) =>
		`${s.row},${s.col},${quantize(s.fuel)},${quantize(s.food)},${s.mode},${s.dismounted ? 1 : 0}`;

	for (const startVehicle of startVehicles) {
		const initial: State = {
			row: startR,
			col: startC,
			fuel: MAX_FUEL,
			food: MAX_FOOD,
			mode: startVehicle,
			dismounted: false,
			path: [startVehicle],
		};

		const visited = new Set<string>();
		const queue: State[] = [initial];
		visited.add(stateKey(initial));

		while (queue.length > 0) {
			const state = queue.shift()!;

			// Try dismount if not already walking and hasn't dismounted
			if (state.mode !== "walk" && !state.dismounted) {
				const dismountState: State = {
					...state,
					mode: "walk",
					dismounted: true,
					path: [...state.path, "dismount"],
				};
				const dk = stateKey(dismountState);
				if (!visited.has(dk)) {
					visited.add(dk);
					queue.push(dismountState);
				}
			}

			// Try each direction
			for (const { dir, dr, dc } of DIRS) {
				const nr = state.row + dr;
				const nc = state.col + dc;

				if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;

				const tile = map[nr][nc];

				// Rocks block everything
				if (tile === "R") continue;

				// Water check
				if (tile === "W" && !VEHICLES[state.mode].canCrossWater) continue;

				// Compute resource cost
				const vehicle = VEHICLES[state.mode];
				let fuelCost = vehicle.fuel;
				const foodCost = vehicle.food;

				// Tree penalty for powered vehicles
				if (tile === "T" && fuelCost > 0) {
					fuelCost += TREE_FUEL_PENALTY;
				}

				const newFuel = +(state.fuel - fuelCost).toFixed(1);
				const newFood = +(state.food - foodCost).toFixed(1);

				if (newFuel < 0 || newFood < 0) continue;

				const newState: State = {
					row: nr,
					col: nc,
					fuel: newFuel,
					food: newFood,
					mode: state.mode,
					dismounted: state.dismounted,
					path: [...state.path, dir],
				};

				// Reached goal
				if (tile === "G") return newState.path;

				const nk = stateKey(newState);
				if (!visited.has(nk)) {
					visited.add(nk);
					queue.push(newState);
				}
			}
		}
	}

	return null;
}

async function queryApi(
	url: string,
	apikey: string,
	query: string,
): Promise<Record<string, unknown>> {
	const res = await fetch(`${BASE_URL}${url}`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ apikey, query }),
	});
	return res.json() as Promise<Record<string, unknown>>;
}

export default {
	name: TASK_NAME,
	title: "S03E05 — Plan optimal route to Skolwin",
	season: 3,
	episode: 5,

	async run(ctx) {
		const { hub, log, env } = ctx;
		const apikey = env.ag3ntsApiKey;

		// --- Discover tools ---
		log.step("Discovering tools via toolsearch");
		const [mapSearch, vehicleSearch, bookSearch] = await Promise.all([
			queryApi("/toolsearch", apikey, "map terrain"),
			queryApi("/toolsearch", apikey, "vehicle transport"),
			queryApi("/toolsearch", apikey, "notes documentation"),
		]);
		log.info(
			`Found tools: ${[mapSearch, vehicleSearch, bookSearch]
				.flatMap((r) =>
					((r.tools as { name: string }[]) || []).map((t) => t.name),
				)
				.filter((v, i, a) => a.indexOf(v) === i)
				.join(", ")}`,
		);

		// --- Get map ---
		log.step("Fetching map for Skolwin");
		const mapData = await queryApi("/maps", apikey, "Skolwin");
		const rawMap = mapData.map as string[][];
		const map = rawMap.map((row) => row.map((cell) => cell as Tile));

		log.info(`Map ${map.length}x${map[0].length}:`);
		for (const row of map) {
			log.detail(row.join(""));
		}

		// --- Get vehicle info ---
		log.step("Fetching vehicle data");
		const vehicleNames = ["rocket", "car", "horse", "walk"];
		const vehicleResults = await Promise.all(
			vehicleNames.map((v) => queryApi("/wehicles", apikey, v)),
		);
		for (const v of vehicleResults) {
			const c = v.consumption as { fuel: number; food: number };
			log.info(`${v.name}: fuel=${c.fuel}, food=${c.food}`);
		}

		// --- Get rules from books ---
		log.step("Fetching rules from books");
		const [legendInfo, waterInfo, rulesInfo] = await Promise.all([
			queryApi("/books", apikey, "terrain types map symbols W T R S G"),
			queryApi("/books", apikey, "water crossing river horse walk"),
			queryApi("/books", apikey, "trees fuel burn penalty"),
		]);
		for (const info of [legendInfo, waterInfo, rulesInfo]) {
			const notes = info.notes as { title: string }[];
			if (notes) {
				for (const n of notes) log.detail(`Book: ${n.title}`);
			}
		}

		// --- Find optimal path ---
		log.step("Computing optimal path");
		const path = findOptimalPath(map);

		if (!path) {
			log.error("No valid path found!");
			return;
		}

		log.info(`Path (${path.length} commands): ${path.join(", ")}`);

		// Calculate resource usage
		const vehicle = path[0] as Vehicle;
		let fuel = MAX_FUEL;
		let food = MAX_FOOD;
		let mode = vehicle;
		let r = -1;
		let c = -1;

		// Find start
		for (let row = 0; row < map.length; row++) {
			for (let col = 0; col < map[0].length; col++) {
				if (map[row][col] === "S") {
					r = row;
					c = col;
				}
			}
		}

		for (let i = 1; i < path.length; i++) {
			const cmd = path[i];
			if (cmd === "dismount") {
				mode = "walk";
				continue;
			}
			const dir = DIRS.find((d) => d.dir === cmd)!;
			r += dir.dr;
			c += dir.dc;
			const tile = map[r][c];
			const v = VEHICLES[mode];
			let fuelCost = v.fuel;
			if (tile === "T" && fuelCost > 0) fuelCost += TREE_FUEL_PENALTY;
			fuel = +(fuel - fuelCost).toFixed(1);
			food = +(food - v.food).toFixed(1);
			log.detail(
				`  ${cmd} → (${r},${c}) ${tile} [${mode}] fuel=${fuel} food=${food}`,
			);
		}
		log.info(`Final: (${r},${c}) fuel=${fuel} food=${food}`);

		// --- Submit ---
		log.step("Submitting route");
		const result = await hub.verify(TASK_NAME, path);

		if (result.message.includes("{FLG:")) {
			log.flag(result);
		} else {
			log.info(`Response [${result.code}]: ${result.message}`);
		}
	},
} satisfies TaskDefinition;
