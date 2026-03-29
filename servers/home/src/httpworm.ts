import { isNormalServer } from "../lib/helper";
import { HostInfoDB } from "./HostInfoDB";

// api/all_hosts/relaysmtp.ts
export async function main(ns: NS) {
	const db = new HostInfoDB(ns);

	for (const info of db.data) {
		if (!info.server) continue;

		const srv = info.server;

		if (!isNormalServer(srv)) continue;
		if (srv.openPortCount === void 0) continue;
		if (srv.numOpenPortsRequired === void 0) continue;
		if (srv.numOpenPortsRequired < 4) continue;
		if (srv.httpPortOpen) continue;
		const host = srv.hostname;

		if (ns.httpworm(host)) {
			ns.tprint(
				"key update httpPortOpen ",
				host,
				" value ",
				true,
				" old ",
				srv.smtpPortOpen,
			);

			srv.httpPortOpen = true;

			const prev_opc = srv.openPortCount;
			srv.openPortCount += 1;

			ns.tprint(
				"key update openPortCount ",
				host,
				" value ",
				srv.openPortCount,
				" old ",
				prev_opc,
			);

			db.notify_changed();
		} else {
			ns.tprint("error httpworm for ", host);
		}
	}

	if (db.was_content_modified) {
		db.save();
	}
}
