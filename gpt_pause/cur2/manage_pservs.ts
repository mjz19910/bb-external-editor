import { PurchasedServers } from "./lib/pservs"

export async function main(ns: NS) {
	const ps = new PurchasedServers(ns)

	const reserve = Number(ns.args[0] ?? 0)
	const minRam = Number(ns.args[1] ?? 8)
	const spendFraction = Number(ns.args[2] ?? 1)
	const loop = Boolean(ns.args[3] ?? false)
	const sleepMs = Number(ns.args[4] ?? 30_000)

	do {
		ps.refresh()

		const money = ns.getServerMoneyAvailable("home")
		const available = Math.max(0, money - reserve)
		const budget = available * spendFraction

		ns.tprint(`Money: ${ns.format.number(money)}`)
		ns.tprint(`Reserve: ${ns.format.number(reserve)}`)
		ns.tprint(`Available: ${ns.format.number(available)}`)
		ns.tprint(`Budget: ${ns.format.number(budget)}`)
		ns.tprint(`Purchased: ${ps.count()}/${ps.limit()}`)
		ns.tprint(`Total RAM: ${ns.format.ram(ps.totalRam())}`)

		if (budget <= 0) {
			ns.tprint("No budget available.")
		} else {
			const action = ps.getBestAction(budget, minRam)

			if (!action) {
				ns.tprint("No affordable buy or upgrade action found.")
			} else if (action.kind === "buy") {
				const name = `pserv-${ps.count()}`
				const host = ns.cloud.purchaseServer(name, action.ram)

				if (!host) {
					ns.tprint(
						`[FAIL] Could not buy ${name} (${ns.format.ram(action.ram)})`
					)
				} else {
					ns.tprint(
						`[BOUGHT] ${host} ${ns.format.ram(action.ram)} ` +
						`for ${ns.format.number(action.cost)} ` +
						`(gain ${ns.format.ram(action.ramGain)}, ` +
						`value ${action.value.toFixed(6)})`
					)
				}
			} else {
				const success = ns.cloud.upgradeServer(action.host, action.toRam)

				if (!success) {
					ns.tprint(
						`[FAIL] Could not upgrade ${action.host} ` +
						`to ${ns.format.ram(action.toRam)}`
					)
				} else {
					ns.tprint(
						`[UPGRADED] ${action.host} ` +
						`${ns.format.ram(action.fromRam)} -> ${ns.format.ram(action.toRam)} ` +
						`for ${ns.format.number(action.cost)} ` +
						`(gain ${ns.format.ram(action.ramGain)}, ` +
						`value ${action.value.toFixed(6)})`
					)
				}
			}
		}

		if (!loop) break

		await ns.sleep(sleepMs)
	} while (true)
}
