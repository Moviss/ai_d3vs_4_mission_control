import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHubClient } from "../hub.js";
import type { EnvConfig } from "../types.js";

const env: EnvConfig = {
	openrouterApiKey: "test-openrouter-key",
	ag3ntsApiKey: "test-ag3nts-key",
};

describe("createHubClient", () => {
	beforeEach(() => {
		vi.stubGlobal("fetch", vi.fn());
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("verify", () => {
		it("sends correct payload to /verify", async () => {
			const mockResponse = { code: 0, message: "{FLG:TEST}" };
			vi.mocked(fetch).mockResolvedValue(
				new Response(JSON.stringify(mockResponse), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				}),
			);

			const hub = createHubClient(env);
			const result = await hub.verify("people", { answer: 42 });

			expect(fetch).toHaveBeenCalledOnce();
			const [url, init] = vi.mocked(fetch).mock.calls[0];
			expect(url).toBe("https://hub.ag3nts.org/verify");
			expect(init?.method).toBe("POST");
			expect(JSON.parse(init?.body as string)).toEqual({
				apikey: "test-ag3nts-key",
				task: "people",
				answer: { answer: 42 },
			});
			expect(result).toEqual(mockResponse);
		});
	});

	describe("fetchData", () => {
		it("returns text for text content-type", async () => {
			vi.mocked(fetch).mockResolvedValue(
				new Response("csv,data,here", {
					status: 200,
					headers: { "Content-Type": "text/csv" },
				}),
			);

			const hub = createHubClient(env);
			const result = await hub.fetchData("people.csv");

			expect(fetch).toHaveBeenCalledOnce();
			const [url] = vi.mocked(fetch).mock.calls[0];
			expect(url).toBe("https://hub.ag3nts.org/dane/people.csv");
			expect(result).toBe("csv,data,here");
		});

		it("returns text for json content-type", async () => {
			vi.mocked(fetch).mockResolvedValue(
				new Response('{"key":"value"}', {
					status: 200,
					headers: { "Content-Type": "application/json" },
				}),
			);

			const hub = createHubClient(env);
			const result = await hub.fetchData("data.json");
			expect(result).toBe('{"key":"value"}');
		});

		it("returns Buffer for binary content-type", async () => {
			const binaryData = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
			vi.mocked(fetch).mockResolvedValue(
				new Response(binaryData, {
					status: 200,
					headers: { "Content-Type": "image/png" },
				}),
			);

			const hub = createHubClient(env);
			const result = await hub.fetchData("image.png");
			expect(Buffer.isBuffer(result)).toBe(true);
		});

		it("throws on non-ok response", async () => {
			vi.mocked(fetch).mockResolvedValue(
				new Response("Not Found", { status: 404, statusText: "Not Found" }),
			);

			const hub = createHubClient(env);
			await expect(hub.fetchData("missing.txt")).rejects.toThrow("Failed to fetch");
		});
	});

	describe("post", () => {
		it("merges apikey into body for relative endpoint", async () => {
			vi.mocked(fetch).mockResolvedValue(
				new Response(JSON.stringify({ ok: true }), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				}),
			);

			const hub = createHubClient(env);
			await hub.post("api/location", { name: "John" });

			const [url, init] = vi.mocked(fetch).mock.calls[0];
			expect(url).toBe("https://hub.ag3nts.org/api/location");
			expect(JSON.parse(init?.body as string)).toEqual({
				apikey: "test-ag3nts-key",
				name: "John",
			});
		});

		it("uses full URL when endpoint starts with http", async () => {
			vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));

			const hub = createHubClient(env);
			await hub.post("https://custom.api.com/endpoint", { data: 1 });

			const [url] = vi.mocked(fetch).mock.calls[0];
			expect(url).toBe("https://custom.api.com/endpoint");
		});
	});

	describe("retry on 503", () => {
		it("retries on 503 and succeeds on second attempt", async () => {
			vi.mocked(fetch)
				.mockResolvedValueOnce(new Response("Service Unavailable", { status: 503 }))
				.mockResolvedValueOnce(
					new Response(JSON.stringify({ code: 0, message: "ok" }), {
						status: 200,
						headers: { "Content-Type": "application/json" },
					}),
				);

			const hub = createHubClient(env);
			const result = await hub.verify("test", "answer");

			expect(fetch).toHaveBeenCalledTimes(2);
			expect(result).toEqual({ code: 0, message: "ok" });
		}, 10000);
	});
});
