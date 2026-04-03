import { HostInfoDB } from "./HostInfoDB"

export async function main(ns: NS) {
	const target = ns.args[0]
	if (typeof target != "string") {
		ns.tprint("target host not a string")
		return
	}
	const db = new HostInfoDB(ns)
	const info = db.find(target)
	if (!info) {
		ns.tprint("no server found")
		return
	}
	const { server: srv } = info
	if ("hasStasisLink" in srv) {
		ns.tprint("not dark net server")
		return
	}
	if (srv.sshPortOpen) {
		ns.tprint(target + " brutessh ignored")
		return
	}
	const success = ns.brutessh(target)
	if (success) {
		srv.sshPortOpen = true
		db.save()
		ns.tprint(target + " brutessh success")
	} else {
		ns.tprint(target + " brutessh failed")
	}
}

export function autocomplete(data: AutocompleteData, _args: ScriptArg[]) {
	return data.servers
}
