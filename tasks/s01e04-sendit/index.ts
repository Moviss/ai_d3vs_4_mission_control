import type { LLMClient, Logger, TaskDefinition } from "@mission/core";

/** Pattern to match include directives in the documentation markdown */
const INCLUDE_PATTERN = /\[include file="([^"]+)"\]/g;

function bufferToDataUrl(buf: Buffer, filename: string): string {
	const ext = filename.split(".").pop()?.toLowerCase() ?? "png";
	const mime = ext === "jpg" ? "image/jpeg" : `image/${ext}`;
	return `data:${mime};base64,${buf.toString("base64")}`;
}

/**
 * Fetches all documentation files referenced by [include file="..."] directives.
 */
async function fetchAllDocs(
	mainDoc: string,
	fetchData: (path: string) => Promise<string | Buffer>,
	log: Logger,
): Promise<{ mainDoc: string; includes: Map<string, string | Buffer> }> {
	const includes = new Map<string, string | Buffer>();
	const matches = [...mainDoc.matchAll(INCLUDE_PATTERN)];

	log.detail(`Znaleziono ${matches.length} dołączonych plików`);

	for (const match of matches) {
		const filename = match[1];
		try {
			log.fetch(`Pobieranie: doc/${filename}`);
			const content = await fetchData(`doc/${filename}`);
			includes.set(filename, content);

			if (typeof content === "string") {
				log.detail(`${filename} — ${content.length} znaków`);
			} else {
				log.detail(`${filename} — ${content.length} bajtów (obraz)`);
			}
		} catch (error) {
			log.warn(`Nie udało się pobrać ${filename}: ${error}`);
		}
	}

	return { mainDoc, includes };
}

/**
 * Uses vision model to extract text content from an image.
 */
async function describeImage(
	imageDataUrl: string,
	filename: string,
	llm: LLMClient,
): Promise<string> {
	const { data: result } = await llm.structured<{ content: string }>({
		model: "google/gemini-2.5-flash",
		system:
			"Jesteś ekspertem od analizy dokumentów. Wyodrębnij całą treść tekstową z obrazu. Zachowaj strukturę tabeli jeśli obraz zawiera tabelę. Odpowiedz w formacie markdown.",
		user: `Wyodrębnij całą treść z tego obrazu dokumentacji (plik: ${filename}). Zachowaj pełną strukturę, kolumny, wiersze i wszystkie dane. Nie pomijaj żadnych informacji.`,
		schema: {
			type: "object",
			properties: {
				content: {
					type: "string",
					description: "Pełna treść wyodrębniona z obrazu w formacie markdown",
				},
			},
			required: ["content"],
			additionalProperties: false,
		},
		images: [imageDataUrl],
	});

	return result.content;
}

/**
 * Builds a comprehensive document from all fetched documentation files,
 * using vision to extract text from images.
 */
async function buildFullDocumentation(
	mainDoc: string,
	includes: Map<string, string | Buffer>,
	llm: LLMClient,
	log: Logger,
): Promise<string> {
	let fullDoc = mainDoc;

	for (const [filename, content] of includes) {
		let textContent: string;

		if (typeof content === "string") {
			textContent = content;
		} else {
			log.llm(`Analiza obrazu: ${filename}`);
			const dataUrl = bufferToDataUrl(content as Buffer, filename);
			textContent = await describeImage(dataUrl, filename, llm);
			log.detail(`Wyodrębniono ${textContent.length} znaków z obrazu`);
		}

		fullDoc = fullDoc.replace(
			`[include file="${filename}"]`,
			`<!-- Zawartość pliku: ${filename} -->\n${textContent}`,
		);
	}

	return fullDoc;
}

export default {
	name: "sendit",
	title: "Deklaracja transportowa SPK",
	season: 1,
	episode: 4,

	async run(ctx) {
		// Step 1: Fetch main documentation
		ctx.log.fetch("Pobieranie dokumentacji SPK...");
		const indexMd = await ctx.hub.fetchData("doc/index.md");
		if (typeof indexMd !== "string") {
			throw new Error("Oczekiwano tekstu z doc/index.md");
		}
		ctx.log.detail(`index.md — ${indexMd.length} znaków`);

		// Step 2: Fetch all included files (text + images)
		ctx.log.step("Pobieranie załączników dokumentacji...");
		const { mainDoc, includes } = await fetchAllDocs(
			indexMd,
			(path) => ctx.hub.fetchData(path),
			ctx.log,
		);

		// Step 3: Build full documentation (using vision for images)
		ctx.log.step("Budowanie pełnej dokumentacji...");
		const fullDocumentation = await buildFullDocumentation(mainDoc, includes, ctx.llm, ctx.log);

		// Step 4: Use LLM to compose the declaration
		ctx.log.llm("Generowanie deklaracji transportowej...");

		const today = new Date().toISOString().split("T")[0];

		const shipmentInfo = `Dane przesyłki do wypełnienia deklaracji:
- Nadawca (identyfikator): 450202122
- Punkt nadawczy: Gdańsk
- Punkt docelowy: Żarnowiec
- Waga: 2800 kg (2,8 tony)
- Zawartość: kasety z paliwem do reaktora
- Uwagi specjalne: brak (nie dodawaj żadnych uwag)
- Budżet: 0 PP (przesyłka ma być darmowa lub finansowana przez System)
- Data: ${today}`;

		const { data: declaration } = await ctx.llm.structured<{ declaration: string }>({
			model: "google/gemini-2.5-flash",
			system: `Jesteś ekspertem od systemu SPK. Na podstawie dostarczonej dokumentacji wypełnij deklarację zawartości przesyłki.

Zasady:
1. Znajdź wzór deklaracji w Załączniku E i wypełnij go DOKŁADNIE według tego wzoru (zachowaj formatowanie, separatory, kolejność pól).
2. Ustal prawidłowy kod trasy z Gdańska do Żarnowca — sprawdź trasy wyłączone.
3. Ustal kategorię przesyłki — kasety z paliwem do reaktora to elementy infrastruktury strategicznej.
4. Oblicz opłatę — uwzględnij kategorię przesyłki i zasady zwolnień.
5. Ustal WDP na podstawie dokumentacji (słownik skrótów, załączniki).
6. Zachowaj DOKŁADNIE formatowanie wzoru — linie separatorów, nagłówki, wielkie litery.
7. Nie dodawaj żadnych uwag specjalnych.`,
			user: `${shipmentInfo}

PEŁNA DOKUMENTACJA SPK:
${fullDocumentation}`,
			schema: {
				type: "object",
				properties: {
					declaration: {
						type: "string",
						description:
							"Pełny tekst wypełnionej deklaracji, sformatowany dokładnie jak wzór z Załącznika E",
					},
				},
				required: ["declaration"],
				additionalProperties: false,
			},
		});

		ctx.log.detail("Wygenerowana deklaracja:");
		for (const line of declaration.declaration.split("\n")) {
			ctx.log.detail(line);
		}

		// Step 5: Submit to hub
		ctx.log.send("Wysyłanie deklaracji do Hub...");
		const result = await ctx.hub.verify("sendit", {
			declaration: declaration.declaration,
		});
		ctx.log.flag(result);

		if (result.code !== 0) {
			ctx.log.warn(`Hub odrzucił deklarację: ${result.message}`);
			ctx.log.info("Spróbuj przeanalizować komunikat błędu i poprawić deklarację.");
		}
	},
} satisfies TaskDefinition;
