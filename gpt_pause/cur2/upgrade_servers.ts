import { PurchasedServers } from "./lib/pservs"

export async function main(ns: NS) {
	const ps = new PurchasedServers(ns)
	const reserve = Number(ns.args[0] ?? 0)
	const minRam = Number(ns.args[1] ?? 8)
	const budgetMul = Number(ns.args[2] ?? 1)

	let money = ns.getServerMoneyAvailable("home")
	const budget = Math.max(0, money - reserve) / ns.cloud.getServerLimit() * budgetMul
	ns.tprint(`Upgrade servers with budget $${ns.format.number(budget)}.`)

	for (; ;) {
		const worst = ps.worst()
		if (!worst) {
			ns.tprint("No purchased servers found.")
			break
		}

		const { best: ram, nextCost } = ps.nextAffordableUpgrade(worst.host, budget, minRam)
		if (ram <= 0) {
			ns.tprint("Cannot afford any upgrade.")
			break
		}

		if (ram <= worst.ram) {
			ns.tprint(`No worthwhile upgrade. Worst=${worst.host} ${ns.format.ram(worst.ram)}, nextCost=${ns.format.number(nextCost)}`)
			break
		}

		const cost = ns.cloud.getServerUpgradeCost(worst.host, ram)
		ns.tprint(`Upgrading ${worst.host} from ${ns.format.ram(worst.ram)} -> ${ns.format.ram(ram)} for ${ns.format.number(cost)}`)

		const succuss = ns.cloud.upgradeServer(worst.host, ram)
		if (!succuss) {
			ns.tprint(`[FAIL] Could not upgrade ${worst.host} to ${ns.format.ram(ram)}`)
			break
		}

		ns.tprint(`[UPGRADED] ${worst.host} now ${ns.format.ram(ram)}`)
		money -= cost
		if (money * 2 < budget) break
	}
}
