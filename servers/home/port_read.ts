import { ScriptPort } from "./type/ScriptPort";
import {
	DarknetAuthenticateMessage,
	DarknetFoundPassProbeMessage,
	DarknetProbeMessage,
	NewWordsMessage,
	QuitMessage,
	WaitMessage,
} from "./type/helper";

export function hasTypeField<T extends { type: string }>(x: unknown): x is T {
	return (
		typeof x === "object" &&
		x !== null &&
		"type" in x &&
		typeof x.type === "string"
	);
}

export function mergeSequencesInPlace(parts: string[][], minOverlap = 4) {
	for (let i = 0; i < parts.length; i++) {
		const current = parts[i];
		if (!current || current.length === 0) continue;

		for (let j = 0; j < i; j++) {
			const prev = parts[j];
			if (!prev || prev.length === 0) continue;

			const maxOverlap = Math.min(prev.length, current.length);
			let overlapLen = 0;

			// Find maximum overlap at end of prev vs start of current
			for (let len = maxOverlap; len >= minOverlap; len--) {
				let match = true;
				for (let k = 0; k < len; k++) {
					if (prev[prev.length - len + k] !== current[k]) {
						match = false;
						break;
					}
				}
				if (match) {
					overlapLen = len;
					break;
				}
			}

			if (overlapLen > 0) {
				// Merge in place: append non-overlapping part to prev
				prev.push(...current.slice(overlapLen));
				// Remove the current list from parts
				parts.splice(i, 1);
				i--; // adjust index because we removed an element
				break;
			}
		}
	}
}

type PortMessage =
	| DarknetAuthenticateMessage
	| WaitMessage
	| QuitMessage
	| NewWordsMessage
	| DarknetProbeMessage
	| DarknetFoundPassProbeMessage;
const pw_db = new Map<string, string>();
const commonPasswordDictionary: string[] = [];
const common_pw_dict_parts: string[][] = [commonPasswordDictionary];
function handle_wait_request(ns: NS, msg: WaitMessage) {
	if (msg.on === "darknet.nextMutation") {
		ns.run("darknet/nextMutation.ts", 1, "--port", msg.reply_port);
	}
}
function handle_object_message(
	ns: NS,
	s: { running: boolean; runner: string; port2: ScriptPort<string | null> },
	msg: PortMessage | {} | null,
) {
	if (msg === null) {
		ns.tprint("null msg ", msg);
		return true;
	}
	if (!hasTypeField<PortMessage>(msg)) {
		ns.tprint("invalid PortMessage ", JSON.stringify(msg, void 0, 2));
		return false;
	}
	switch (msg.type) {
		case "wait": {
			return handle_wait_request(ns, msg);
		}
		case "quit": {
			s.running = false;
			return true;
		}
		case "darknet.authenticate": {
			pw_db.set(msg.for, msg.password);
			return true;
		}
		case "new_words": {
			if (commonPasswordDictionary.length === 0) {
				commonPasswordDictionary.push(...msg.list);
			} else {
				common_pw_dict_parts.push(msg.list);
				mergeSequencesInPlace(common_pw_dict_parts);
				ns.tprint("words ", JSON.stringify(common_pw_dict_parts));
			}
			return true;
		}
		case "darknet.probe": {
			if (msg.alt === "ip") {
				for (const ip of msg.results) {
					ns.tprint(`found ip ${ip} connected to ${msg.for}`);
				}
				s.port2.write<string>("query_ips " + msg.results.join(","));
				ns.run("darknet/query_security.ts", 1);
			} else {
				for (const info of msg.infos) {
					if (info.password === null) {
						ns.tprint("unauth server " + info.server.hostname);
					}
				}
			}
			return true;
		}
		case "found_password": {
			const t: DarknetFoundPassProbeMessage = msg;
			ns.tprintRaw(
				`got a session to ${
					t.for.padEnd(13, " ")
				} with password='${t.password}'`,
			);
			return true;
		}
		default: {
			ns.tprint(
				"new handler required for " + (msg as { type: string }).type,
			);
			// ns.tprint("handler for ", JSON.stringify(msg, void 0))
			return false;
		}
	}
}
const REPLY_PORT = 2;
const API_PORT = 3;
export async function main(ns: NS) {
	const { port: requestPort } = ns.flags([["port", 1]]) as { port: number };
	if (requestPort > 1 && requestPort < 4) {
		return ns.tprint("port conflict requestPort=", requestPort);
	}
	const port = new ScriptPort(ns, requestPort);
	const port2 = new ScriptPort(ns, REPLY_PORT);
	const port3 = new ScriptPort(ns, API_PORT);
	port3.clear("empty before use");
	ns.run("src/getHostname.ts", 1);
	await port3.nextWrite("wait for hostname");
	const v = port3.readOpt<string>("read hostname");
	if (v.type === "None") return ns.tprint("missing port(3).getHostname()");
	const s = {
		running: true,
		runner: v.value,
		port,
		port2,
	};
	port.config({ logging: false });
	ns.print("enter read loop");
	for (; s.running;) {
		for (; !port.empty("run until empty");) {
			const res = port.read<PortMessage | {} | null>("read message");
			if (typeof res === "object") {
				handle_object_message(ns, s, res);
				continue;
			}
			ns.tprint(
				"unknown(1) port message ",
				JSON.stringify(res, void 0, 2),
			);
		}
		await port.nextWrite("wait for wakeup");
	}
}
