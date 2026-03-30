import { NS } from "../@ns";
import { isNormalServer } from "../lib/helper";
import { HostInfoDB } from "./HostInfoDB";

export async function main(ns: NS) {
	const db = new HostInfoDB(ns);
	for (const info of db.data) {
		const srv = info.server;
		const host = srv.hostname;
		if (srv.hasAdminRights) continue;
		if (!isNormalServer(srv)) continue;
		if (srv.openPortCount === void 0) continue;
		if (srv.numOpenPortsRequired === void 0) continue;
		if (srv.openPortCount < srv.numOpenPortsRequired) continue;
		if (ns.nuke(host)) {
			ns.tprint("nuke " + host);
			const prev = srv.hasAdminRights;
			ns.tprint(
				"key update hasAdminRights ",
				host,
				" value ",
				true,
				" old ",
				prev,
			);
			srv.hasAdminRights = true;
			db.notify_changed();
		} else {
			ns.tprint("nuke failed ", host);
		}
	}
	if (db.was_content_modified) {
		db.save();
	}
}
