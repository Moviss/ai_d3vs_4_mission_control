import type { TaskDefinition } from "@mission/core";
import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const TASK_NAME = "evaluation";
const SENSORS_URL = "https://hub.ag3nts.org/dane/sensors.zip";

// Sensor type → measurement field mapping
const SENSOR_FIELD_MAP: Record<string, string> = {
	temperature: "temperature_K",
	pressure: "pressure_bar",
	water: "water_level_meters",
	voltage: "voltage_supply_v",
	humidity: "humidity_percent",
};

// Valid ranges for active sensors
const VALID_RANGES: Record<string, [number, number]> = {
	temperature_K: [553, 873],
	pressure_bar: [60, 160],
	water_level_meters: [5.0, 15.0],
	voltage_supply_v: [229.0, 231.0],
	humidity_percent: [40.0, 80.0],
};

const ALL_FIELDS = Object.values(SENSOR_FIELD_MAP);

// Operator note first clauses that indicate the operator claims there's a problem
const NEGATIVE_NOTE_STARTERS = [
	"This state looks unstable",
	"The numbers feel inconsistent",
	"The latest behavior is concerning",
	"These readings look suspicious",
	"This is not the pattern I expected",
	"This check did not look right",
	"The signal profile looks unusual",
	"This report raises serious doubts",
	"The current result seems unreliable",
	"I can see a clear irregularity",
	"The report does not look healthy",
	"There is a visible anomaly here",
	"I am seeing an unexpected pattern",
	"This run shows questionable behavior",
	"The situation requires attention",
	"The output quality is doubtful",
	"I am not comfortable with this result",
	"Something is clearly off",
];

interface SensorReading {
	sensor_type: string;
	timestamp: number;
	temperature_K: number;
	pressure_bar: number;
	water_level_meters: number;
	voltage_supply_v: number;
	humidity_percent: number;
	operator_notes: string;
}

function checkDataAnomaly(reading: SensorReading): boolean {
	const types = reading.sensor_type.split("/").map((s) => s.trim());
	const activeFields = new Set(types.map((t) => SENSOR_FIELD_MAP[t]).filter(Boolean));

	for (const field of ALL_FIELDS) {
		const value = reading[field as keyof SensorReading] as number;

		if (activeFields.has(field)) {
			const [min, max] = VALID_RANGES[field];
			if (value < min || value > max) return true;
		} else {
			if (value !== 0) return true;
		}
	}

	return false;
}

function noteClaimsProblem(note: string): boolean {
	const firstClause = note.split(",")[0].trim();
	return NEGATIVE_NOTE_STARTERS.some((neg) => firstClause.startsWith(neg));
}

export default {
	name: TASK_NAME,
	title: "S03E01 — Find anomalies in sensor readings",
	season: 3,
	episode: 1,

	async run(ctx) {
		const { hub, log } = ctx;
		const dataDir = ctx.data;

		// --- Download & extract ---
		log.step("Downloading sensor data");
		const zipPath = join(dataDir, "sensors.zip");

		if (!existsSync(zipPath)) {
			const response = await fetch(SENSORS_URL);
			const buffer = Buffer.from(await response.arrayBuffer());
			writeFileSync(zipPath, buffer);
			log.info(`Downloaded sensors.zip (${buffer.length} bytes)`);
			execSync(`unzip -qo "${zipPath}" -d "${dataDir}"`, { maxBuffer: 50 * 1024 * 1024 });
			log.info("Extracted sensor files");
		} else {
			log.info("Using cached sensor data");
		}

		// --- Read all sensor files ---
		log.step("Reading sensor files");
		const files = readdirSync(dataDir)
			.filter((f) => f.endsWith(".json"))
			.sort();
		log.info(`Found ${files.length} sensor files`);

		const readings = new Map<string, SensorReading>();
		for (const file of files) {
			const content = readFileSync(join(dataDir, file), "utf-8");
			readings.set(file.replace(".json", ""), JSON.parse(content) as SensorReading);
		}

		// --- Detect all anomalies programmatically ---
		log.step("Detecting anomalies");

		const anomalies: string[] = [];
		let dataBad = 0;
		let noteContradictsData = 0;

		for (const [id, reading] of readings) {
			const dataOk = !checkDataAnomaly(reading);
			const claimsProblem = noteClaimsProblem(reading.operator_notes);

			let isAnomaly = false;

			// Data out of range or inactive sensor returning data
			if (!dataOk) {
				isAnomaly = true;
				dataBad++;
			}

			// Operator says problem but data is fine
			if (dataOk && claimsProblem) {
				isAnomaly = true;
				noteContradictsData++;
			}

			if (isAnomaly) {
				anomalies.push(id);
			}
		}

		anomalies.sort();

		log.info(`Data anomalies: ${dataBad}`);
		log.info(`Note contradicts data: ${noteContradictsData}`);
		log.info(`Total unique anomalies: ${anomalies.length}`);

		// --- Submit ---
		log.step(`Submitting ${anomalies.length} anomaly IDs`);
		log.detail(`First 10: ${anomalies.slice(0, 10).join(", ")}`);
		log.detail(`Last 10: ${anomalies.slice(-10).join(", ")}`);

		const result = await hub.verify(TASK_NAME, { recheck: anomalies });

		if (result.message.includes("{FLG:")) {
			log.flag(result);
		} else {
			log.info(`Response [${result.code}]: ${result.message}`);
		}
	},
} satisfies TaskDefinition;
