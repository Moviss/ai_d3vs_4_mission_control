import type { TaskDefinition } from "@mission/core";

const TASK_NAME = "shellaccess";

interface ShellResponse {
	code: number;
	message: string;
	output?: string;
	[key: string]: unknown;
}

export default {
	name: TASK_NAME,
	title: "S05E03 — Search time archive for Rafał via remote shell",
	season: 5,
	episode: 3,

	async run(ctx) {
		const { hub, log } = ctx;

		const exec = async (cmd: string): Promise<string> => {
			log.fetch(`$ ${cmd}`);
			const res = (await hub.verify(TASK_NAME, { cmd })) as ShellResponse;
			const output = res.output ?? res.message ?? "";
			log.detail(`[${res.code}] ${String(output).slice(0, 600)}`);
			return String(output);
		};

		// 1. Search for body/ciało entries in the time archive
		log.step("Searching for body/ciało entries in /data/time_logs.csv");
		const bodyEntries = await exec(
			"grep -i -E 'ciało|zwłoki|znaleziono.*ciało' /data/time_logs.csv",
		);

		// 2. Parse the body entry (CSV: date;description;location;place)
		log.step("Parsing body entry");
		const bodyLine = bodyEntries
			.split("\n")
			.find((l) => l.includes("ciało"));

		if (!bodyLine) {
			log.error("No body entry found");
			return;
		}

		const [findingDate, , locationIdStr, placeIdStr] = bodyLine.split(";");
		const locationId = Number(locationIdStr.trim());
		const placeId = Number(placeIdStr.trim());

		// Compute day before
		const d = new Date(findingDate.trim());
		d.setDate(d.getDate() - 1);
		const answerDate = d.toISOString().split("T")[0];

		log.info(`Body found: ${findingDate}, location=${locationId}, place=${placeId}`);
		log.info(`Answer date (day before): ${answerDate}`);

		// 3. Get city name for location ID
		log.step("Looking up city name");
		const cityResult = await exec(
			`echo 'CITY:' && jq '.[] | select(.location_id == ${locationId}) | .name' /data/locations.json`,
		);
		const cityName = cityResult.replace("CITY:", "").trim().replace(/"/g, "");
		log.info(`City: ${cityName}`);

		// 4. Get GPS coordinates (extract as raw values to avoid JSON detection)
		log.step("Fetching GPS coordinates");
		const latResult = await exec(
			`jq -r '.[] | select(.entry_id == ${placeId}) | .latitude' /data/gps.json`,
		);
		const lonResult = await exec(
			`jq -r '.[] | select(.entry_id == ${placeId}) | .longitude' /data/gps.json`,
		);

		const latitude = Number(latResult.trim());
		const longitude = Number(lonResult.trim());

		if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
			log.warn(`Raw lat/lon failed (lat=${latResult}, lon=${lonResult}), trying alternate field names`);
			const latAlt = await exec(
				`jq -r '[.[] | select(.location_id == ${locationId})][0] | .latitude' /data/gps.json`,
			);
			const lonAlt = await exec(
				`jq -r '[.[] | select(.location_id == ${locationId})][0] | .longitude' /data/gps.json`,
			);
			log.info(`Alt coords: lat=${latAlt.trim()}, lon=${lonAlt.trim()}`);
		}

		log.info(`Coordinates: lon=${longitude}, lat=${latitude}`);

		// 5. Submit final answer
		log.step("Submitting answer");
		const answer = {
			date: answerDate,
			city: cityName,
			longitude,
			latitude,
		};

		log.info(`Final answer: ${JSON.stringify(answer)}`);
		const echoJson = JSON.stringify(answer);
		const finalRes = await exec(`echo '${echoJson}'`);

		const fullRes = JSON.stringify({ output: finalRes });
		if (fullRes.includes("{FLG:") || finalRes.includes("{FLG:")) {
			log.flag({ code: 0, message: finalRes });
		} else {
			log.warn(`Response: ${finalRes}`);
		}
	},
} satisfies TaskDefinition;
