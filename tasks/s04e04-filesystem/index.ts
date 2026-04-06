import type { TaskDefinition } from "@mission/core";

const TASK_NAME = "filesystem";
const HUB_URL = "https://hub.ag3nts.org/verify";

// What each city needs (from ogłoszenia.txt) — no Polish chars, no units
const cityNeeds: Record<string, Record<string, number>> = {
	opalino: { chleb: 45, woda: 120, mlotek: 6 },
	domatowo: { makaron: 60, woda: 150, lopata: 8 },
	brudzewo: { ryz: 55, woda: 140, wiertarka: 5 },
	darzlubie: { wolowina: 25, woda: 130, kilof: 7 },
	celbowo: { kurczak: 40, woda: 125, mlotek: 6 },
	mechowo: { ziemniak: 100, kapusta: 70, marchew: 65, woda: 165, lopata: 9 },
	puck: { chleb: 50, ryz: 45, woda: 175, wiertarka: 7 },
	karlinkowo: { makaron: 52, wolowina: 22, ziemniak: 95, woda: 155, kilof: 6 },
};

// Trade managers per city (from rozmowy.txt)
const people = [
	{ name: "Natan Rams", file: "natan_rams", city: "domatowo" },
	{ name: "Iga Kapecka", file: "iga_kapecka", city: "opalino" },
	{ name: "Rafal Kisiel", file: "rafal_kisiel", city: "brudzewo" },
	{ name: "Marta Frantz", file: "marta_frantz", city: "darzlubie" },
	{ name: "Oskar Radtke", file: "oskar_radtke", city: "celbowo" },
	{ name: "Eliza Redmann", file: "eliza_redmann", city: "mechowo" },
	{ name: "Damian Kroll", file: "damian_kroll", city: "puck" },
	{ name: "Lena Konkel", file: "lena_konkel", city: "karlinkowo" },
];

// Which cities sell each good (from transakcje.txt: source -> item -> dest)
const goodsSellers: Record<string, string[]> = {
	ryz: ["darzlubie", "opalino", "karlinkowo"],
	marchew: ["puck"],
	chleb: ["domatowo", "celbowo", "brudzewo"],
	wolowina: ["opalino"],
	kilof: ["puck", "mechowo", "celbowo"],
	wiertarka: ["karlinkowo", "domatowo"],
	maka: ["brudzewo", "mechowo"],
	mlotek: ["karlinkowo", "mechowo"],
	makaron: ["opalino"],
	kapusta: ["celbowo"],
	ziemniak: ["domatowo", "darzlubie"],
	kurczak: ["darzlubie"],
	lopata: ["brudzewo", "puck"],
};

export default {
	name: TASK_NAME,
	title: "S04E04 — Organize Natan's trade notes into filesystem",
	season: 4,
	episode: 4,

	async run(ctx) {
		const { env, log } = ctx;
		const apikey = env.ag3ntsApiKey;

		const api = async (answer: unknown) => {
			const res = await fetch(HUB_URL, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ apikey, task: TASK_NAME, answer }),
			});
			return res.json() as Promise<Record<string, unknown>>;
		};

		// 1. Reset filesystem
		log.step("Resetting filesystem");
		const resetRes = await api({ action: "reset" });
		log.info(`Reset: [${resetRes.code}] ${resetRes.message}`);

		// 2. Build batch operations
		log.step("Building filesystem structure");
		const batch: { action: string; path?: string; content?: string }[] = [];

		batch.push({ action: "createDirectory", path: "/miasta" });
		batch.push({ action: "createDirectory", path: "/osoby" });
		batch.push({ action: "createDirectory", path: "/towary" });

		for (const [city, needs] of Object.entries(cityNeeds)) {
			batch.push({
				action: "createFile",
				path: `/miasta/${city}`,
				content: JSON.stringify(needs),
			});
		}

		for (const person of people) {
			batch.push({
				action: "createFile",
				path: `/osoby/${person.file}`,
				content: `${person.name}\n\n[${person.city}](/miasta/${person.city})`,
			});
		}

		for (const [good, sellers] of Object.entries(goodsSellers)) {
			const links = sellers
				.map((city) => `[${city}](/miasta/${city})`)
				.join("\n");
			batch.push({
				action: "createFile",
				path: `/towary/${good}`,
				content: links,
			});
		}

		log.info(
			`Batch: ${batch.length} ops (3 dirs, ${Object.keys(cityNeeds).length} cities, ${people.length} people, ${Object.keys(goodsSellers).length} goods)`,
		);

		// 3. Send batch
		log.step("Sending batch");
		const batchRes = await api(batch);
		log.info(`Batch result: [${batchRes.code}] ${batchRes.message}`);

		// 4. Verify
		log.step("Running verification");
		const doneRes = await api({ action: "done" });
		log.info(`Done: [${doneRes.code}] ${doneRes.message}`);

		if (String(doneRes.message).includes("{FLG:")) {
			log.flag({
				code: doneRes.code as number,
				message: doneRes.message as string,
			});
		} else {
			log.warn(`No flag — response: ${JSON.stringify(doneRes)}`);
		}
	},
} satisfies TaskDefinition;
