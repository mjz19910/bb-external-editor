import { NS } from "./@ns";
import { DarknetServer } from "../src/darknet/misc";
import { DarknetServerInfo } from "../src/darknet/types";
import { ScriptPort } from "../src/type/ScriptPort";
import {
	HostnameReplyMsg,
	OnlineCheckMsg,
	PortMessage,
	PortReleaseMsg,
	QuerySecurityMsg,
	WaitMessage,
} from "../src/type/helper";

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

const pw_db = new Map<string, string>();
const commonPasswordDictionary: string[] = [];
const common_pw_dict_parts: string[][] = [commonPasswordDictionary];
function handle_wait_request(ns: NS, msg: WaitMessage) {
	if (msg.on === "darknet.nextMutation") {
		ns.run("darknet/nextMutation.ts", 1, "--port", msg.reply_port);
	}
}
const db = new class {
	server_map = new Map<string, DarknetServerInfo>();
	servers_by_ip = new Map<string, DarknetServerInfo>();
	server_map_decay_list: DarknetServerInfo[] = [];
}();
type StateType = {
	running: boolean;
	runner: string;
	port: ScriptPort<PortMessage>;
	port2: ScriptPort<OnlineCheckMsg>;
	port3: ScriptPort<QuerySecurityMsg>;
	is_api_port_busy: boolean;
};
function handle_port_release(ns: NS, msg: PortReleaseMsg) {
	for (const info of msg.infos) {
		const my_info = db.servers_by_ip.get(info.ip);
		if (my_info) {
			const k = msg.updated_key;
			if (k === "authDetails") {
				my_info.authDetails = info.authDetails;
			} else {
				ns.tprint("new key to update ", k);
			}
		} else {
			db.servers_by_ip.set(info.ip, info);
		}
	}
}
function handle_object_message(ns: NS, s: StateType, msg: PortMessage) {
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
				if (!s.is_api_port_busy) {
					s.is_api_port_busy = true;
					s.port3.write<QuerySecurityMsg>({
						type: "query_security",
						ips: msg.results,
						infos: msg.results.map((v) => {
							return {
								ip: v,
								connectedToParent: false,
							};
						}),
					});
					ns.run("darknet/query_security.ts", 1);
				}
			} else {
				const ips: string[] = [];
				for (const info of msg.infos) {
					if (info.server === void 0) continue;
					ips.push(info.server.ip);
					if (!info.connectedToParent) {
						continue;
					}
					db.server_map.set(info.server.hostname, info);
				}
				const infos_timeout = msg.infos;
				setTimeout(function () {
					for (const info of infos_timeout) {
						db.server_map_decay_list.push(info);
					}
					s.port.write({ type: "timeout_check" });
				}, 30_000);
				const all_infos = [];
				for (const item of db.server_map.values()) {
					all_infos.push(item);
				}
				if (ips.length > 0) {
					s.port2.write<OnlineCheckMsg>({
						cmd: "online_check",
						args: ips,
					});
				}
			}
			return true;
		}
		case "timeout_check": {
			const ips: string[] = [];
			for (const info of db.server_map_decay_list) {
				if (info.server === void 0) continue;
				ips.push(info.server.ip);
			}
			if (ips.length > 0) {
				s.port2.write<OnlineCheckMsg>({
					cmd: "online_check",
					args: ips,
				});
			}
			return true;
		}
		case "online_servers": {
			const query_map: Record<string, DarknetServer> = {};
			for (const srv of msg.result.darkweb) {
				if (!db.server_map.has(srv.hostname)) {
					db.server_map.set(srv.hostname, {
						ip: srv.ip,
						connectedToParent: false,
						server: srv,
					});
					query_map[srv.hostname] = srv;
					continue;
				}
				query_map[srv.hostname] = srv;
			}
			for (let i = 0; i < db.server_map_decay_list.length; i++) {
				const info = db.server_map_decay_list[i];
				const srv = info.server;
				if (srv === void 0) {
					db.server_map_decay_list.splice(i, 1);
					i--;
					continue;
				}
				const host = srv.hostname;
				if (query_map[host]) {
					info.server = query_map[host];
				}
				if (
					query_map[srv.hostname] && query_map[srv.hostname].isOnline
				) {
					db.server_map_decay_list.splice(i, 1);
					i--;
				}
				if (!db.server_map.has(srv.hostname)) {
					db.server_map_decay_list.splice(i, 1);
					i--;
				}
			}
			db.server_map_decay_list.length = 0;
			return true;
		}
		case "found_password": {
			return true;
		}
		case "port_release":
			if (msg.port === 3) {
				s.is_api_port_busy = false;
			}
			handle_port_release(ns, msg);
			return true;
		default: {
			ns.tprint(
				"new handler required for " + (msg as { type: string }).type,
			);
			return false;
		}
	}
}
export async function main(ns: NS) {
	const port = ScriptPort.open_request_port(ns);
	const port2 = ScriptPort.open_reply_port(ns);
	const port3 = ScriptPort.open_api_port(ns);
	port3.clear("empty before use");
	ns.run("src/getHostname.ts", 1);
	await port3.nextWrite("wait for hostname");
	const v = port3.read<HostnameReplyMsg>("read hostname");
	const s: StateType = {
		running: true,
		runner: v.hostname,
		port,
		port2,
		port3,
		is_api_port_busy: false,
	};
	port.config({ logging: false });
	ns.print("enter read loop");
	for (; s.running;) {
		for (; !port.empty("run until empty");) {
			const res = port.read<PortMessage>("read message");
			handle_object_message(ns, s, res);
		}
		await port.nextWrite("wait for wakeup");
	}
}
