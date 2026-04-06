import { HacknetManager } from "../lib/hacknet"

export async function main(ns: NS) {
	const hacknet = new HacknetManager(ns)

	const reserve = Number(ns.args[0] ?? 0)
	const spendFraction = Number(ns.args[1] ?? 1)
	const loop = Boolean(ns.args[2] ?? false)
	const sleepMs = Number(ns.args[3] ?? 30_000)

	do {
		hacknet.refresh()

		const money = ns.getServerMoneyAvailable("home")
		const available = Math.max(0, money - reserve)
		const budget = available * spendFraction

		ns.tprint(`Money: ${ns.format.number(money)}`)
		ns.tprint(`Reserve: ${ns.format.number(reserve)}`)
		ns.tprint(`Budget: ${ns.format.number(budget)}`)
		ns.tprint(`Hacknet Nodes: ${hacknet.count()}`)
		ns.tprint(`Hacknet Production: ${hacknet.totalProduction().toFixed(3)}/s`)

		if (budget <= 0) {
			ns.tprint("No Hacknet budget available.")
		} else {
			const best = hacknet.chooseBestOption(budget)

			if (!best) {
				ns.tprint("No affordable Hacknet upgrade found.")
			} else {
				const payback = hacknet.getPaybackTimeSeconds(best)
				const success = hacknet.applyOption(best)

				if (!success) {
					ns.tprint(`[FAIL] Could not apply Hacknet option: ${best.label}`)
				} else {
					ns.tprint(
						`[HACKNET] ${best.label} ` +
						`for ${ns.format.number(best.cost)} ` +
						`(gain ${best.gain.toFixed(4)}/s, ` +
						`roi ${best.roi.toFixed(8)}, ` +
						`payback ${ns.format.time(payback * 1000)})`
					)
				}
			}
		}

		if (!loop) break
		await ns.sleep(sleepMs)
	} while (true)
}
