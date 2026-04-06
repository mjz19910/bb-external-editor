import { PurchasedServers } from "../lib/pservs"

export async function main(ns: NS) {
	const ps = new PurchasedServers(ns)
	const f = ns.flags([["loop", false]]) as { loop?: boolean, _: ScriptArg[] }
	const args = f._

	const loop = Boolean(f.loop ?? false)

	const reserve = Number(args[0] ?? 0)
	const minRam = Number(args[1] ?? 8)
	const spendFraction = Number(args[2] ?? 0.15)
	const sleepMs = Number(args[3] ?? 30_000)

	do {
		let do_short_sleep = false

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

					do_short_sleep = true
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

					do_short_sleep = true
				}
			}
		}

		if (!loop) break

		if (do_short_sleep) {
			await ns.sleep(500)
		} else {
			await ns.sleep(sleepMs)
		}
	} while (true)
}
