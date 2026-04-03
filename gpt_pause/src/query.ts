import { HostInfoDB } from "./HostInfoDB"
export async function main(ns: NS) {
	if (typeof ns.args[0] != "string") {
		ns.tprint("no target")
		return
	}
	const target = ns.args[0]
	const db = new HostInfoDB(ns)
	const info = db.find(target)
	const srv = info.server
	if (srv === null) return ns.tprint("missing srv")
	if ("hasStasisLink" in srv) return
	if (srv.hackDifficulty === void 0) {
		return ns.tprint("missing server hackDifficulty")
	}
	if (srv.moneyAvailable === void 0) {
		return ns.tprint("missing server moneyAvailable")
	}
	const sec_lvl = srv.hackDifficulty
	ns.tprint(ns.getServerSecurityLevel(target), " ", sec_lvl)
	const money = srv.moneyAvailable
	ns.tprint(ns.getServerMoneyAvailable(target), " ", money)
	ns.tprint(target, " security ", Math.floor(sec_lvl * 1000) / 1000)
	ns.tprint(target, " money $", ns.format.number(money, 2))
}
export function autocomplete(data: AutocompleteData, args: ScriptArg[]) {
	if (args.length === 0) return data.servers
	if (typeof args[0] != "string") return []
	if (data.servers.includes(args[0])) return []
	return data.servers
}
