import type { TaskDefinition } from "@mission/core";

const TASK_NAME = "okoeditor";

// IDs discovered from the OKO web panel
const SKOLWIN_ID = "380792b2c86d9c5be670b3bde48e187b";
const KOMAROWO_TARGET_ID = "8b04cb375286948cbe22b446b81921ba";

// Incident codes from the OKO coding reference note:
// MOVE01 = human, MOVE02 = vehicle, MOVE03 = vehicle+human, MOVE04 = animals
const ANIMAL_CODE = "MOVE04";
const HUMAN_CODE = "MOVE01";

interface OkoApiResponse {
	code: number;
	message: string;
	status?: string;
}

export default {
	name: TASK_NAME,
	title: "S04E01 — Modify OKO surveillance records to cover tracks",
	season: 4,
	episode: 1,

	async run(ctx) {
		const { hub, log } = ctx;

		// Step 1: Reclassify Skolwin incident from vehicles/people (MOVE03) to animals (MOVE04)
		log.step("Reclassifying Skolwin incident to animals");
		const skolwinIncident = (await hub.verify(TASK_NAME, {
			action: "update",
			page: "incydenty",
			id: SKOLWIN_ID,
			title: `${ANIMAL_CODE} Aktywność zwierząt w okolicach miasta Skolwin`,
			content:
				"Czujniki zarejestrowały ruch zwierząt w okolicach rzeki nieopodal miasta Skolwin. Obserwowano grupę bobrów przemieszczających się wzdłuż brzegu.",
		})) as OkoApiResponse;
		log.info(`Skolwin incident: [${skolwinIncident.code}] ${skolwinIncident.message}`);

		// Step 2: Mark Skolwin task as done with animal observation note
		log.step("Marking Skolwin task as done");
		const skolwinTask = (await hub.verify(TASK_NAME, {
			action: "update",
			page: "zadania",
			id: SKOLWIN_ID,
			content:
				"W okolicach Skolwina widziano zwierzęta. Na nagraniach widać bobry przy rzece.",
			done: "YES",
		})) as OkoApiResponse;
		log.info(`Skolwin task: [${skolwinTask.code}] ${skolwinTask.message}`);

		// Step 3: Create Komarowo incident to divert attention
		log.step("Adding Komarowo human movement incident");
		const komarowoIncident = (await hub.verify(TASK_NAME, {
			action: "update",
			page: "incydenty",
			id: KOMAROWO_TARGET_ID,
			title: `${HUMAN_CODE} Wykrycie ruchu ludzi w okolicach miasta Komarowo`,
			content:
				"Wykryto ruch ludzi w okolicach niezamieszkałego miasta Komarowo. Sensory odnotowały aktywność kilku osób poruszających się w kierunku centrum. Wymagana dalsza obserwacja.",
		})) as OkoApiResponse;
		log.info(
			`Komarowo incident: [${komarowoIncident.code}] ${komarowoIncident.message}`,
		);

		// Step 4: Verify all changes and get flag
		log.step("Running verification");
		const result = await hub.verify(TASK_NAME, { action: "done" });

		if (result.message.includes("{FLG:")) {
			log.flag(result);
		} else {
			log.warn(`Verification failed [${result.code}]: ${result.message}`);
		}
	},
} satisfies TaskDefinition;
