import type { TaskDefinition } from "@mission/core";

interface Person {
	name: string;
	surname: string;
	gender: string;
	born: number;
	city: string;
	job: string;
}

interface TaggedPerson {
	name: string;
	surname: string;
	gender: string;
	born: number;
	city: string;
	tags: string[];
}

const AVAILABLE_TAGS = [
	"IT",
	"transport",
	"edukacja",
	"medycyna",
	"praca z ludźmi",
	"praca z pojazdami",
	"praca fizyczna",
] as const;

const TAG_DESCRIPTIONS: Record<string, string> = {
	IT: "Praca związana z informatyką, programowaniem, systemami komputerowymi, bazami danych, sieciami",
	transport:
		"Praca związana z przewozem towarów, logistyką, spedycją, kierowaniem pojazdami, planowaniem tras",
	edukacja: "Praca związana z nauczaniem, szkoleniem, przekazywaniem wiedzy, prowadzeniem zajęć",
	medycyna: "Praca związana ze zdrowiem, leczeniem, diagnozowaniem, opieką medyczną, farmacją",
	"praca z ludźmi":
		"Praca wymagająca bezpośredniego kontaktu z ludźmi, obsługi klienta, mediacji, doradztwa",
	"praca z pojazdami": "Praca związana z naprawą, konserwacją lub obsługą pojazdów mechanicznych",
	"praca fizyczna": "Praca wymagająca wysiłku fizycznego, pracy manualnej, rzemiosła, budowy",
};

function parseCSV(csv: string): Person[] {
	const lines = csv.trim().split("\n");
	const people: Person[] = [];

	for (let i = 1; i < lines.length; i++) {
		const line = lines[i];
		const fields = parseCSVLine(line);
		if (fields.length < 7) continue;

		const [name, surname, gender, birthDate, birthPlace, _birthCountry, job] = fields;
		const born = Number.parseInt(birthDate.split("-")[0], 10);

		people.push({
			name,
			surname,
			gender,
			born,
			city: birthPlace,
			job,
		});
	}

	return people;
}

function parseCSVLine(line: string): string[] {
	const fields: string[] = [];
	let current = "";
	let inQuotes = false;

	for (let i = 0; i < line.length; i++) {
		const char = line[i];
		if (char === '"') {
			inQuotes = !inQuotes;
		} else if (char === "," && !inQuotes) {
			fields.push(current.trim());
			current = "";
		} else {
			current += char;
		}
	}
	fields.push(current.trim());

	return fields;
}

function filterPeople(people: Person[]): Person[] {
	return people.filter((p) => {
		if (p.gender !== "M") return false;
		const age = 2026 - p.born;
		if (age < 20 || age > 40) return false;
		if (p.city !== "Grudziądz") return false;
		return true;
	});
}

const taggingSchema = {
	type: "object",
	properties: {
		results: {
			type: "array",
			items: {
				type: "object",
				properties: {
					index: {
						type: "number",
						description: "Index of the person in the input list (0-based)",
					},
					tags: {
						type: "array",
						items: {
							type: "string",
							enum: [...AVAILABLE_TAGS],
						},
						description: "Tags assigned to this person based on their job description",
					},
				},
				required: ["index", "tags"],
				additionalProperties: false,
			},
			description: "List of tagging results, one per input person",
		},
	},
	required: ["results"],
	additionalProperties: false,
};

export default {
	name: "people",
	title: "Filtruj osoby z transportu",
	season: 1,
	episode: 1,

	async run(ctx) {
		ctx.log.fetch("Pobieranie danych z hubu...");
		const csvUrl = `https://hub.ag3nts.org/data/${ctx.env.ag3ntsApiKey}/people.csv`;
		const response = await fetch(csvUrl);
		if (!response.ok) {
			throw new Error(`Failed to fetch people.csv: ${response.status} ${response.statusText}`);
		}
		const csv = await response.text();
		const allPeople = parseCSV(csv);
		ctx.log.detail(`people.csv \u2014 ${allPeople.length} rekord\u00F3w`);

		ctx.log.process("Filtrowanie os\u00F3b...");
		const filtered = filterPeople(allPeople);
		ctx.log.detail(
			`M\u0119\u017Cczy\u017Ani 20-40 lat, Grudzi\u0105dz \u2192 ${filtered.length} os\u00F3b`,
		);

		ctx.log.llm("Tagowanie zawod\u00F3w przez LLM...");
		ctx.log.detail("Model: gpt-4.1-mini");
		const tagDescriptions = Object.entries(TAG_DESCRIPTIONS)
			.map(([tag, desc]) => `- ${tag}: ${desc}`)
			.join("\n");

		const jobList = filtered.map((p, i) => `${i}. ${p.name} ${p.surname}: ${p.job}`).join("\n");

		const { data: tagResult } = await ctx.llm.structured<{
			results: { index: number; tags: string[] }[];
		}>({
			model: "openai/gpt-4.1-mini",
			system: `Jeste\u015B ekspertem od klasyfikacji zawod\u00F3w. Przypisz odpowiednie tagi do ka\u017Cdej osoby na podstawie opisu jej pracy.

Dost\u0119pne tagi i ich opisy:
${tagDescriptions}

Zasady:
- Jedna osoba mo\u017Ce mie\u0107 wiele tag\u00F3w
- Przypisuj tag tylko gdy opis pracy wyra\u017Anie pasuje do danej kategorii
- Je\u015Bli opis pracy nie pasuje do \u017Cadnego tagu, zwr\u00F3\u0107 pust\u0105 tablic\u0119 tag\u00F3w`,
			user: `Przypisz tagi do poni\u017Cszych os\u00F3b na podstawie opisu ich pracy:\n\n${jobList}`,
			schema: taggingSchema,
		});

		const tagged: TaggedPerson[] = filtered.map((p, i) => {
			const result = tagResult.results.find((r) => r.index === i);
			return {
				name: p.name,
				surname: p.surname,
				gender: p.gender,
				born: p.born,
				city: p.city,
				tags: result?.tags ?? [],
			};
		});

		const transportPeople = tagged.filter((p) => p.tags.includes("transport"));
		ctx.log.success(
			`${filtered.length} rekord\u00F3w \u2192 ${transportPeople.length} z tagiem "transport"`,
		);

		for (const p of transportPeople) {
			ctx.log.detail(`${p.name} ${p.surname} (${p.born}) \u2014 [${p.tags.join(", ")}]`);
		}

		ctx.log.send("Wysy\u0142anie odpowiedzi do Hub...");
		const result = await ctx.hub.verify("people", transportPeople);
		ctx.log.flag(result);
	},
} satisfies TaskDefinition;
