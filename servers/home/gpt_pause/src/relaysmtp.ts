import { NS } from "./@ns";
import { isNormalServer } from "./lib/helper";
import { HostInfoDB } from "./HostInfoDB";

// api/all_hosts/relaysmtp.ts
export async function main(ns: NS) {
	const db = new HostInfoDB(ns);

	for (const info of db.data) {
		const srv = info.server;
		if (!isNormalServer(srv)) continue;
		if (srv.openPortCount === void 0) continue;
		if (srv.numOpenPortsRequired === void 0) continue;
		if (srv.numOpenPortsRequired < 3) continue;
		if (srv.smtpPortOpen) continue;

		if (ns.relaysmtp(srv.hostname)) {
			ns.tprint(
				"key update smtpPortOpen ",
				srv.hostname,
				" value ",
				true,
				" old ",
				srv.smtpPortOpen,
			);

			srv.smtpPortOpen = true;

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
			ns.tprint("error relaysmtp for ", srv.hostname);
		}
	}

	if (db.was_content_modified) {
		db.save();
	}
}
