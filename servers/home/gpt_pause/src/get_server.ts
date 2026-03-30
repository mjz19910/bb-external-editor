import { NS, Server } from "../../@ns";
import { HostInfoDB } from "./HostInfoDB";
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
		const new_srv = ns.getServer(host);
		if ("depth" in new_srv) continue;
		if (host === "home") {
			new_srv.ramUsed -= 1.6;
			new_srv.ramUsed -= 2;
		}
		new_srv.ramUsed = Math.round(new_srv.ramUsed * 100) / 100;
		if (new_srv.moneyAvailable !== void 0) {
			new_srv.moneyAvailable = Math.round(new_srv.moneyAvailable);
		}
		for (const key in new_srv) {
			const kt: keyof Server = key as keyof Server;
			if (new_srv[kt] !== info.server[kt]) {
				ns.tprint(
					"key update ",
					key,
					" ",
					host,
					" value ",
					new_srv[kt],
					" old ",
					info.server[kt],
				);
				set_key(info.server, new_srv, kt);
				db.notify_changed();
			}
		}
	}
	if (db.was_content_modified) {
		db.save();
	}
}
