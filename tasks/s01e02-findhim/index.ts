import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { TaskDefinition } from "@mission/core";

interface Suspect {
	name: string;
	surname: string;
	born: number;
}

interface PowerPlant {
	is_active: boolean;
	power: string;
	code: string;
}

interface LocationsData {
	power_plants: Record<string, PowerPlant>;
}

interface Coordinate {
	latitude: number;
	longitude: number;
}

// Approximate coordinates of cities with power plants
const CITY_COORDS: Record<string, Coordinate> = {
	Zabrze: { latitude: 50.3249, longitude: 18.7857 },
	"Piotrków Trybunalski": { latitude: 51.4053, longitude: 19.7031 },
	Grudziądz: { latitude: 53.4837, longitude: 18.7536 },
	Tczew: { latitude: 54.0927, longitude: 18.7997 },
	Radom: { latitude: 51.4027, longitude: 21.1471 },
	Chelmno: { latitude: 53.3492, longitude: 18.426 },
	Żarnowiec: { latitude: 54.7603, longitude: 18.0572 },
};

const PROXIMITY_THRESHOLD_KM = 25;

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
	const R = 6371;
	const toRad = (d: number) => (d * Math.PI) / 180;
	const dLat = toRad(lat2 - lat1);
	const dLon = toRad(lon2 - lon1);
	const a =
		Math.sin(dLat / 2) ** 2 +
		Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
	return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function findNearestPlant(
	lat: number,
	lon: number,
	plants: Record<string, PowerPlant>,
): { city: string; code: string; distance: number } | null {
	let best: { city: string; code: string; distance: number } | null = null;

	for (const [city, data] of Object.entries(plants)) {
		const coords = CITY_COORDS[city];
		if (!coords) continue;
		const dist = haversineKm(lat, lon, coords.latitude, coords.longitude);
		if (!best || dist < best.distance) {
			best = { city, code: data.code, distance: dist };
		}
	}

	return best;
}

// Suspects from S01E01 — people tagged with "transport" from Grudziądz
const SUSPECTS: Suspect[] = [
	{ name: "Cezary", surname: "Żurek", born: 1987 },
	{ name: "Jacek", surname: "Nowak", born: 1991 },
	{ name: "Oskar", surname: "Sieradzki", born: 1993 },
	{ name: "Wojciech", surname: "Bielik", born: 1986 },
	{ name: "Wacław", surname: "Jasiński", born: 1986 },
];

export default {
	name: "findhim",
	title: "Namierz podejrzanego przy elektrowni",
	season: 1,
	episode: 2,

	async run(ctx) {
		// Step 1: Fetch power plant locations
		ctx.log.fetch("Pobieranie lokalizacji elektrowni...");
		let locationsData: LocationsData;

		const cacheFile = join(ctx.data, "findhim_locations.json");
		if (existsSync(cacheFile)) {
			locationsData = JSON.parse(await readFile(cacheFile, "utf-8"));
			ctx.log.detail("Użyto cache z data/findhim_locations.json");
		} else {
			const url = `https://hub.ag3nts.org/data/${ctx.env.ag3ntsApiKey}/findhim_locations.json`;
			const response = await fetch(url);
			if (!response.ok) {
				throw new Error(
					`Failed to fetch findhim_locations.json: ${response.status} ${response.statusText}`,
				);
			}
			locationsData = (await response.json()) as LocationsData;
			await mkdir(ctx.data, { recursive: true });
			await writeFile(cacheFile, JSON.stringify(locationsData, null, 2));
			ctx.log.detail("Pobrano i zapisano do cache");
		}

		const plants = locationsData.power_plants;
		ctx.log.detail(`${Object.keys(plants).length} elektrowni na liście`);

		// Step 2: Check locations of each suspect
		ctx.log.process("Odpytywanie API o lokalizacje podejrzanych...");

		const candidates: {
			suspect: Suspect;
			plant: { city: string; code: string; distance: number };
		}[] = [];

		for (const suspect of SUSPECTS) {
			ctx.log.detail(`${suspect.name} ${suspect.surname}...`);

			const coords = (await ctx.hub.post("api/location", {
				name: suspect.name,
				surname: suspect.surname,
			})) as Coordinate[];

			if (!Array.isArray(coords)) {
				ctx.log.warn(`Brak koordynatów dla ${suspect.name} ${suspect.surname}`);
				continue;
			}

			for (const point of coords) {
				const nearest = findNearestPlant(point.latitude, point.longitude, plants);
				if (nearest && nearest.distance < PROXIMITY_THRESHOLD_KM) {
					ctx.log.success(
						`${suspect.name} ${suspect.surname} — ${nearest.distance.toFixed(1)} km od ${nearest.city} (${nearest.code})`,
					);
					candidates.push({ suspect, plant: nearest });
				}
			}
		}

		if (candidates.length === 0) {
			ctx.log.error("Nie znaleziono nikogo w pobliżu elektrowni.");
			return;
		}

		// Step 3: Pick the best candidate (closest to a plant)
		candidates.sort((a, b) => a.plant.distance - b.plant.distance);
		const best = candidates[0];
		ctx.log.process(
			`Najlepszy kandydat: ${best.suspect.name} ${best.suspect.surname} (${best.plant.distance.toFixed(1)} km od ${best.plant.city})`,
		);

		// Step 4: Fetch access level
		ctx.log.fetch(`Pobieranie poziomu dostępu dla ${best.suspect.name} ${best.suspect.surname}...`);
		const accessData = (await ctx.hub.post("api/accesslevel", {
			name: best.suspect.name,
			surname: best.suspect.surname,
			birthYear: best.suspect.born,
		})) as { accessLevel: number } | number;

		const accessLevel =
			typeof accessData === "object" && accessData !== null
				? (accessData as { accessLevel: number }).accessLevel
				: accessData;

		ctx.log.detail(`Poziom dostępu: ${accessLevel}`);

		// Step 5: Submit answer
		const answer = {
			name: best.suspect.name,
			surname: best.suspect.surname,
			accessLevel,
			powerPlant: best.plant.code,
		};

		ctx.log.send("Wysyłanie odpowiedzi do Hub...");
		ctx.log.detail(JSON.stringify(answer));
		const result = await ctx.hub.verify("findhim", answer);
		ctx.log.flag(result);
	},
} satisfies TaskDefinition;
