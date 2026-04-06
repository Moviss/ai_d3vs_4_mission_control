import type { TaskDefinition } from "@mission/core";

const TASK_NAME = "radiomonitoring";

interface ApiResponse {
	code: number;
	message: string;
	transcription?: string;
	meta?: string;
	attachment?: string;
	filesize?: number;
	[key: string]: unknown;
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

const MORSE_MAP: Record<string, string> = {
	".-": "A", "-...": "B", "-.-.": "C", "-..": "D", ".": "E",
	"..-.": "F", "--.": "G", "....": "H", "..": "I", ".---": "J",
	"-.-": "K", ".-..": "L", "--": "M", "-.": "N", "---": "O",
	".--.": "P", "--.-": "Q", ".-.": "R", "...": "S", "-": "T",
	"..-": "U", "...-": "V", ".--": "W", "-..-": "X", "-.--": "Y",
	"--..": "Z", ".----": "1", "..---": "2", "...--": "3", "....-": "4",
	".....": "5", "-....": "6", "--...": "7", "---..": "8", "----.": "9",
	"-----": "0", "-..-.": "/",
};

function decodeMorse(text: string): string | null {
	if (!text.includes("Ti") || !text.includes("Ta")) return null;
	const cleaned = text.replace(/\*[^*]+\*/g, "").trim();
	const words = cleaned.split(/\(stop\)/i);
	const decoded = words
		.map((word) => {
			const chars = word.trim().split(/\s+/).filter(Boolean);
			return chars
				.map((ch) => {
					const morse = ch.replace(/Ta/g, "-").replace(/Ti/g, ".");
					return MORSE_MAP[morse] ?? `[${morse}]`;
				})
				.join("");
		})
		.join(" ");
	return decoded || null;
}

export default {
	name: TASK_NAME,
	title: "S05E01 — Radio monitoring to find Syjon city",
	season: 5,
	episode: 1,

	async run(ctx) {
		const { hub, llm, log } = ctx;

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

		// ── 1. Start session ──
		log.step("Starting radio monitoring session");
		const startRes = await api({ action: "start" });
		log.info(`Start: [${startRes.code}] ${startRes.message}`);

		// ── 2. Listen loop ──
		log.step("Listening for signals");
		const transcriptions: string[] = [];
		const decodedFiles: string[] = [];
		const mediaDataUris: { uri: string; type: "image" | "audio" }[] = [];
		let listenCount = 0;

		while (true) {
			const res = await api({ action: "listen" });
			listenCount++;

			if (res.code !== 100) {
				log.info(`Listen ended after ${listenCount} calls: [${res.code}] ${res.message}`);
				if (res.transcription) transcriptions.push(res.transcription);
				break;
			}

			// Text transcription
			if (res.transcription) {
				log.detail(`[${listenCount}] Text: ${res.transcription.slice(0, 120)}`);
				const morseDecoded = decodeMorse(res.transcription);
				if (morseDecoded) {
					log.info(`  Morse decoded: ${morseDecoded}`);
					transcriptions.push(
						`[Morse code]\nOriginal: ${res.transcription}\nDecoded: ${morseDecoded}`,
					);
				} else {
					transcriptions.push(res.transcription);
				}
				continue;
			}

			// Binary attachment
			if (res.attachment && res.meta) {
				const mime = res.meta;
				const sizeKB = res.filesize ? Math.round(res.filesize / 1024) : "?";
				log.detail(`[${listenCount}] File: ${mime} (${sizeKB} KB)`);

				const buf = Buffer.from(res.attachment, "base64");

				// Text-based: decode locally
				if (
					mime.includes("text") ||
					mime.includes("json") ||
					mime.includes("xml") ||
					mime.includes("csv")
				) {
					const text = buf.toString("utf-8");
					log.detail(`  Decoded ${text.length} chars`);
					decodedFiles.push(`[File: ${mime}]\n${text}`);
					continue;
				}

				// Images: save for vision
				if (mime.startsWith("image/")) {
					log.detail("  Saved image for vision analysis");
					mediaDataUris.push({
						uri: `data:${mime};base64,${res.attachment}`,
						type: "image",
					});
					continue;
				}

				// Audio: save for AI transcription (Gemini supports audio via data URI)
				if (mime.startsWith("audio/")) {
					log.detail("  Saved audio for AI transcription");
					mediaDataUris.push({
						uri: `data:${mime};base64,${res.attachment}`,
						type: "audio",
					});
					continue;
				}

				// Other binary: try text decode
				const text = buf.toString("utf-8");
				if (/[\w\s]{20,}/.test(text) && !text.includes("\0")) {
					decodedFiles.push(`[File: ${mime}]\n${text}`);
				} else {
					log.detail(`  Skipped binary: ${mime}`);
				}
				continue;
			}

			log.detail(`[${listenCount}] Noise: ${res.message}`);
		}

		log.info(
			`Collected: ${transcriptions.length} transcriptions, ${decodedFiles.length} files, ${mediaDataUris.length} media`,
		);

		// ── 3. Analyze media (images + audio) with Gemini ──
		const mediaAnalyses: string[] = [];
		for (let i = 0; i < mediaDataUris.length; i++) {
			const { uri, type } = mediaDataUris[i];
			log.process(`Analyzing ${type} ${i + 1}/${mediaDataUris.length}`);

			const systemPrompt =
				type === "audio"
					? "Transcribe this audio recording completely. Extract ALL spoken words, names, numbers, phone numbers, city names, warehouse counts, and any factual data. Every detail matters."
					: "Extract ALL text, numbers, names, coordinates, phone numbers, and any data visible in the image. Be thorough.";

			try {
				const result = await llm.structured<{ content: string }>({
					model: "google/gemini-2.5-flash",
					system: systemPrompt,
					user: `Analyze this ${type} and extract all information.`,
					images: [uri],
					schema: {
						type: "object",
						properties: {
							content: {
								type: "string",
								description: "All extracted information",
							},
						},
						required: ["content"],
						additionalProperties: false,
					},
				});
				log.detail(`${type} ${i + 1}: ${result.data.content.slice(0, 300)}`);
				mediaAnalyses.push(
					`[${type === "audio" ? "Audio transcription" : "Image"} ${i + 1}]\n${result.data.content}`,
				);
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				log.warn(`Failed to analyze ${type} ${i + 1}: ${msg}`);
			}
		}

		// ── 4. Extract report data ──
		log.step("Extracting report data");

		const allMaterials = [
			...transcriptions.map((t, i) => `[Transcription ${i + 1}]\n${t}`),
			...decodedFiles,
			...mediaAnalyses,
		].join("\n\n---\n\n");

		log.info(`Total material: ${allMaterials.length} chars`);
		log.detail(allMaterials);

		const extraction = await llm.structured<{
			cityName: string;
			cityArea: string;
			warehousesCount: number;
			phoneNumber: string;
			reasoning: string;
		}>({
			model: "google/gemini-2.5-flash",
			system: `You analyze intercepted radio communications about a city codenamed "Syjon" (Zion).
Extract these facts:
- cityName: the REAL name of the city referred to as "Syjon". Cross-reference descriptions (cattle, river, high prices, "miasto ocalałych", "biblijny raj") with city data.
- cityArea: area of the city from the JSON data, with exactly 2 decimal places (properly rounded).
- warehousesCount: the CURRENT number of warehouses that EXIST in Syjon right now. IMPORTANT: if someone says they "plan to build warehouse #N" or "wybudować N-ty magazyn", that means N-1 warehouses currently exist. Only count warehouses that are already built, not planned ones.
- phoneNumber: contact phone number associated with Syjon.

Cross-reference all sources carefully. The JSON file contains occupiedArea for each city — use that for the matching city.`,
			user: `Intercepted materials:\n\n${allMaterials}`,
			schema: {
				type: "object",
				properties: {
					cityName: { type: "string", description: "Real name of the city called Syjon" },
					cityArea: {
						type: "string",
						description: "City area rounded to 2 decimal places, format: 12.34",
					},
					warehousesCount: { type: "number", description: "Number of warehouses" },
					phoneNumber: { type: "string", description: "Contact phone number" },
					reasoning: {
						type: "string",
						description: "Brief explanation of how each piece was found",
					},
				},
				required: ["cityName", "cityArea", "warehousesCount", "phoneNumber", "reasoning"],
				additionalProperties: false,
			},
		});

		const data = extraction.data;
		log.info(
			`City: ${data.cityName}, Area: ${data.cityArea}, Warehouses: ${data.warehousesCount}, Phone: ${data.phoneNumber}`,
		);
		log.detail(`Reasoning: ${data.reasoning}`);

		// ── 5. Transmit report ──
		log.step("Transmitting final report");
		const report = await api({
			action: "transmit",
			cityName: data.cityName,
			cityArea: data.cityArea,
			warehousesCount: data.warehousesCount,
			phoneNumber: data.phoneNumber,
		});

		log.info(`Report: [${report.code}] ${report.message}`);
		if (String(report.message).includes("{FLG:")) {
			log.flag({ code: report.code, message: String(report.message) });
		}
	},
} satisfies TaskDefinition;
