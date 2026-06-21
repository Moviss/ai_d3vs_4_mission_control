import type { TaskDefinition } from "@mission/core";

const TASK_NAME = "phonecall";
const VOICE_ID = "pNInz6obpgDQGcFmaJgB"; // Adam

interface PhoneResponse {
	code: number;
	message: string;
	audio?: string;
	msg?: string;
	[key: string]: unknown;
}

export default {
	name: TASK_NAME,
	title: "S05E02 — Phone call to operator for road clearance",
	season: 5,
	episode: 2,

	async run(ctx) {
		const { hub, llm, log, env } = ctx;

		const elevenKey = env.ELVEVENLABS_API_KEY;
		if (!elevenKey) throw new Error("Missing ELVEVENLABS_API_KEY in .env");

		const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

		const speak = async (text: string): Promise<string> => {
			const res = await fetch(
				`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_128`,
				{
					method: "POST",
					headers: {
						"xi-api-key": elevenKey,
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						text,
						model_id: "eleven_multilingual_v2",
						voice_settings: {
							stability: 0.7,
							similarity_boost: 0.85,
						},
					}),
				},
			);
			if (!res.ok) {
				throw new Error(
					`ElevenLabs: ${res.status} ${await res.text()}`,
				);
			}
			return Buffer.from(await res.arrayBuffer()).toString("base64");
		};

		const api = async (
			answer: Record<string, unknown>,
		): Promise<PhoneResponse> =>
			(await hub.verify(TASK_NAME, answer)) as unknown as PhoneResponse;

		const sendAudio = async (text: string): Promise<PhoneResponse> => {
			log.send(`→ ${text}`);
			const audio = await speak(text);
			const res = await api({ audio });
			log.info(`[${res.code}] ${res.message.slice(0, 120)}`);
			return res;
		};

		const hear = async (res: PhoneResponse): Promise<string> => {
			if (res.audio) {
				try {
					const result = await llm.structured<{ text: string }>({
						model: "google/gemini-2.5-flash",
						system:
							"Dokładnie przepisz to nagranie audio po polsku. Zwróć dokładne wypowiedziane słowa.",
						user: "Transkrybuj nagranie.",
						images: [`data:audio/mp3;base64,${res.audio}`],
						schema: {
							type: "object",
							properties: { text: { type: "string" } },
							required: ["text"],
							additionalProperties: false,
						},
					});
					log.fetch(`← ${result.data.text}`);
					return result.data.text;
				} catch {
					log.warn("Transcription failed, using message");
				}
			}
			log.fetch(`← ${res.message}`);
			return res.message;
		};

		const isOk = (res: PhoneResponse) => res.code >= 0;
		const hasFlag = (res: PhoneResponse, text: string): boolean => {
			if (`${res.message} ${text}`.includes("{FLG:")) {
				log.flag({ code: res.code, message: String(res.message) });
				return true;
			}
			return false;
		};

		for (let attempt = 1; attempt <= 10; attempt++) {
			log.step(`=== Attempt ${attempt} ===`);

			const startRes = await api({ action: "start" });
			log.info(`Session: [${startRes.code}] ${startRes.msg ?? startRes.message}`);

			// ── Introduction ──
			const introRes = await sendAudio("Cześć, tu Tymon Gajewski.");
			if (!isOk(introRes)) {
				log.warn(`Intro rejected (${introRes.code})`);
				await delay(2000);
				continue;
			}
			const introText = await hear(introRes);
			if (hasFlag(introRes, introText)) return;

			// ── Road inquiry ──
			const roadsRes = await sendAudio(
				"Chciałbym zapytać o status trzech dróg: RD224, RD472 i RD820. Pytam w związku z transportem organizowanym do jednej z baz Zygfryda.",
			);
			if (!isOk(roadsRes)) {
				log.warn(`Roads rejected (${roadsRes.code})`);
				await delay(2000);
				continue;
			}
			const roadsText = await hear(roadsRes);
			if (hasFlag(roadsRes, roadsText)) return;

			if (!roadsText.match(/RD|820|472|224|przejezdn|nieprzejezdn/i)) {
				log.warn("No road info in response, restarting");
				await delay(2000);
				continue;
			}

			const extraction = await llm.structured<{
				passableRoads: string[];
			}>({
				model: "google/gemini-2.5-flash",
				system:
					"Extract passable road codes from Polish text. Format: RD820.",
				user: `"${roadsText}" — Which of RD224, RD472, RD820 are passable?`,
				schema: {
					type: "object",
					properties: {
						passableRoads: {
							type: "array",
							items: { type: "string" },
						},
					},
					required: ["passableRoads"],
					additionalProperties: false,
				},
			});
			const roadCode = extraction.data.passableRoads[0] ?? "RD820";
			log.info(`Passable: ${roadCode}`);

			// ── Monitoring disable WITH REASON ──
			const disableRes = await sendAudio(
				`Poproszę o wyłączenie monitoringu na drodze ${roadCode}. Chodzi o tajny transport żywności do jednej z tajnych baz Zygfryda.`,
			);
			if (!isOk(disableRes)) {
				log.warn(`Disable rejected (${disableRes.code})`);
				await delay(2000);
				continue;
			}
			const disableText = await hear(disableRes);
			if (hasFlag(disableRes, disableText)) return;

			// ── Follow-ups ──
			const history = [
				`Tymon: Cześć, tu Tymon Gajewski.`,
				`Operator: ${introText}`,
				`Tymon: [zapytanie o drogi + Zygfryd]`,
				`Operator: ${roadsText}`,
				`Tymon: Poproszę o wyłączenie monitoringu na drodze ${roadCode}. Chodzi o tajny transport żywności do jednej z tajnych baz Zygfryda.`,
				`Operator: ${disableText}`,
			];

			let failed = false;
			for (let i = 0; i < 6; i++) {
				log.step(`Follow-up ${i + 1}`);

				const decision = await llm.structured<{
					category: string;
					customResponse: string;
					done: boolean;
				}>({
					model: "google/gemini-2.5-flash",
					system: `Jesteś Tymon Gajewski. Analizujesz odpowiedź operatora.
Cel: wyłączyć monitoring na ${roadCode}. Hasło: BARBAKAN.

Kategorie:
- "password" — pyta o hasło/autoryzację
- "reason" — pyta dlaczego (tajny transport żywności do jednej z tajnych baz Zygfryda)
- "confirm" — prosi o potwierdzenie
- "custom" — inna (customResponse, krótko, po polsku)
- "done" — monitoring wyłączony / flaga`,
					user: history.join("\n"),
					schema: {
						type: "object",
						properties: {
							category: {
								type: "string",
								enum: [
									"password",
									"reason",
									"confirm",
									"custom",
									"done",
								],
							},
							customResponse: { type: "string" },
							done: { type: "boolean" },
						},
						required: ["category", "customResponse", "done"],
						additionalProperties: false,
					},
				});

				if (decision.data.done || decision.data.category === "done") {
					log.success("Conversation complete");
					return;
				}

				const responses: Record<string, string> = {
					password: "BARBAKAN",
					reason: "To jest tajny transport żywności do jednej z tajnych baz Zygfryda. Lokalizacja bazy nie może być ujawniona.",
					confirm: "Tak, potwierdzam.",
				};
				const cat = decision.data.category;
				const nextText =
					responses[cat] ?? decision.data.customResponse;
				log.detail(`Category: ${cat}`);

				const followRes = await sendAudio(nextText);
				if (!isOk(followRes)) {
					log.warn(`Follow-up rejected (${followRes.code})`);
					failed = true;
					break;
				}
				const followText = await hear(followRes);
				if (hasFlag(followRes, followText)) return;

				history.push(
					`Tymon: ${nextText}`,
					`Operator: ${followText}`,
				);
			}

			if (failed) {
				await delay(2000);
				continue;
			}
			break;
		}
	},
} satisfies TaskDefinition;
