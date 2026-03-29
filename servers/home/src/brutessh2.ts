import { HostInfoDB } from "./HostInfoDB"

export async function main(ns: NS) {
	const db = new HostInfoDB(ns)
	for (const info of db.data) {
		const srv = info.server
		if (!srv) {
			ns.tprint("skip brutessh for ", srv.hostname, " no server_info")
			continue
		}
		if (srv.openPortCount === void 0) continue
		if (srv.numOpenPortsRequired === void 0) continue
		if (srv.numOpenPortsRequired < 1) continue
		if (srv.sshPortOpen) continue
		if (ns.brutessh(srv.hostname)) {
			ns.tprint("key update sshPortOpen ", srv.hostname, " value ", true, " old ", srv.sshPortOpen)
			srv.sshPortOpen = true
			const prev_opc = srv.openPortCount
			srv.openPortCount += 1
			ns.tprint("key update openPortCount ", srv.hostname, " value ", srv.openPortCount, " old ", prev_opc)
			db.notify_changed()
		} else {
			ns.tprint("error brutessh for ", srv.hostname)
		}
	}
	if (db.was_content_modified) {
		db.save()
	}
}