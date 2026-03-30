import { NS } from "../../@ns";
import { isNormalServer } from "../lib/helper";
import { HostInfoDB } from "./HostInfoDB";

export async function main(ns: NS) {
	const db = new HostInfoDB(ns);
	for (const info of db.data) {
		const srv = info.server;
		if (srv === null) continue;
		if (!isNormalServer(srv)) continue;
		if (srv.openPortCount === void 0) continue;
		if (srv.numOpenPortsRequired === void 0) continue;
		if (srv.numOpenPortsRequired < 2) continue;
		if (srv.ftpPortOpen) continue;
		if (ns.ftpcrack(srv.hostname)) {
			ns.tprint(
				"key update ftpPortOpen ",
				srv.hostname,
				" value ",
				true,
				" old ",
				srv.ftpPortOpen,
			);
			srv.ftpPortOpen = true;
			const prev_opc = srv.openPortCount;
			srv.openPortCount += 1;
			ns.tprint(
				"key update openPortCount ",
				srv.hostname,
				" value ",
				srv.openPortCount,
				" old ",
				prev_opc,
			);
			db.notify_changed();
		} else {
			ns.tprint("error ftpcrack for ", srv.hostname);
		}
	}
	if (db.was_content_modified) db.save();
}
