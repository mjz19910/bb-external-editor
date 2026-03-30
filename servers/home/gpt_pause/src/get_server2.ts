import { NS, Server } from "../../@ns";
import { HostInfoDB } from "../../src/HostInfoDB";
function set_key<U, K extends keyof U>(base: U, updated: U, k: K): U[K] {
	return base[k] = updated[k];
}
export async function main(ns: NS) {
	if (ns.args.length > 0) {
		ns.tprint("provide no arguments to get_server.ts");
		return;
	}
	const db: HostInfoDB<Server> = new HostInfoDB(ns);
	for (const info of db.data) {
		const srv = info.server;
		const host = srv.hostname;
		const new_info = ns.getServer(host);
		if ("depth" in new_info) continue;
		if (host === "home") {
			new_info.ramUsed -= 1.6;
			new_info.ramUsed -= 2;
		}
		if (info.server === void 0 || info.server === null) {
			info.server = new_info;
			db.notify_changed();
			continue;
		}
		new_info.ramUsed = Math.round(new_info.ramUsed * 100) / 100;
		if (new_info.moneyAvailable !== void 0) {
			new_info.moneyAvailable = Math.round(new_info.moneyAvailable);
		}
		for (const key in new_info) {
			const kt: keyof Server = key as keyof Server;
			if (new_info[kt] !== info.server[kt]) {
				ns.tprint(
					"key update ",
					key,
					" ",
					host,
					" value ",
					new_info[kt],
					" old ",
					info.server[kt],
				);
				set_key(info.server, new_info, kt);
				db.notify_changed();
			}
		}
	}
	if (db.was_content_modified) {
		db.save();
	}
}
