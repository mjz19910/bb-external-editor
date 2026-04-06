import {
	PurchasedServers,
} from "./lib/pservs"

export async function main(ns: NS) {
	const ps = new PurchasedServers(ns)
	const reserve = Number(ns.args[0] ?? 0)
	const minRam = Number(ns.args[1] ?? 8)

	const money = ns.getServerMoneyAvailable("home")
	const budget = Math.max(0, money - reserve)

	const current = ps.getInfo()
	const limit = ps.limit()

	ns.tprint(`Money: ${ns.format.number(money)}`)
	ns.tprint(`Reserve: ${ns.format.number(reserve)}`)
	ns.tprint(`Budget: ${ns.format.number(budget)}`)
	ns.tprint(`Purchased: ${current.length}/${limit}`)

	if (current.length >= limit) {
		ns.tprint("Purchased server limit already reached.")
		return
	}

	const ram = ps.nextAffordableRam(budget, minRam)
	if (ram <= 0) {
		ns.tprint(`Cannot afford even ${minRam}GB server.`)
		return
	}

	const cost = ps.cost(ram)
	let bought = 0
	let idx = current.length

	while (idx < limit) {
		const cash = ns.getServerMoneyAvailable("home")
		if (cash - reserve < cost) break

		const name = `pserv-${idx}`
		const host = ns.cloud.purchaseServer(name, ram)

		if (!host) {
			ns.tprint(`[FAIL] Could not buy ${name} (${ram}GB)`)
			break
		}

		bought++
		ns.tprint(`[BOUGHT] ${host} ${ram}GB for ${ns.format.number(cost)}`)
		idx++
	}

	ns.tprint(`Bought ${bought} server(s) at ${ram}GB each.`)
}
