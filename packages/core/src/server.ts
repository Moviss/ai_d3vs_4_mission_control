import type { ServerType } from "@hono/node-server";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import type { TaskServer } from "./types.js";

export function createTaskServer(): TaskServer {
	const app = new Hono();
	let server: ServerType | null = null;
	let serverUrl = "";

	return {
		app,

		get url() {
			return serverUrl;
		},

		async start(port = 0) {
			return new Promise<{ url: string; port: number }>((resolve) => {
				server = serve({ fetch: app.fetch, port }, (info) => {
					const assignedPort = info.port;
					serverUrl = `http://localhost:${assignedPort}`;
					resolve({ url: serverUrl, port: assignedPort });
				});
			});
		},

		async stop() {
			const s = server;
			if (!s) return;
			return new Promise<void>((resolve, reject) => {
				s.close((err) => {
					server = null;
					serverUrl = "";
					if (err) reject(err);
					else resolve();
				});
			});
		},
	};
}
