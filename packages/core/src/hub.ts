import type { EnvConfig, HubClient, HubResponse } from "./types.js";

const HUB_BASE_URL = "https://hub.ag3nts.org";
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;

async function fetchWithRetry(
	url: string,
	init: RequestInit,
	retries = MAX_RETRIES,
): Promise<Response> {
	let lastError: Error | undefined;

	for (let attempt = 0; attempt <= retries; attempt++) {
		const response = await fetch(url, init);

		if (response.status !== 503 || attempt === retries) {
			return response;
		}

		lastError = new Error(`HTTP 503 from ${url}`);
		const delay = INITIAL_BACKOFF_MS * 2 ** attempt;
		await new Promise((resolve) => setTimeout(resolve, delay));
	}

	throw lastError;
}

export function createHubClient(env: EnvConfig): HubClient {
	const apikey = env.ag3ntsApiKey;

	return {
		async verify(task: string, answer: unknown): Promise<HubResponse> {
			const url = `${HUB_BASE_URL}/verify`;
			const response = await fetchWithRetry(url, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ apikey, task, answer }),
			});

			return (await response.json()) as HubResponse;
		},

		async fetchData(path: string): Promise<string | Buffer> {
			const url = `${HUB_BASE_URL}/dane/${path}`;
			const response = await fetchWithRetry(url, { method: "GET" });

			if (!response.ok) {
				throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
			}

			const contentType = response.headers.get("content-type") ?? "";
			if (
				contentType.startsWith("text/") ||
				contentType.includes("json") ||
				contentType.includes("xml")
			) {
				return response.text();
			}

			const arrayBuffer = await response.arrayBuffer();
			return Buffer.from(arrayBuffer);
		},

		async post(endpoint: string, body: unknown): Promise<unknown> {
			const url = endpoint.startsWith("http") ? endpoint : `${HUB_BASE_URL}/${endpoint}`;

			const response = await fetchWithRetry(url, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ apikey, ...((body as object) ?? {}) }),
			});

			return response.json();
		},
	};
}
