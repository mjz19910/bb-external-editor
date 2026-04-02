import { nextAffordableRamUpgrade, worstPurchasedServer } from "./lib/pservs"

export async function main(ns: NS) {
	const reserve = Number(ns.args[0] ?? 0)
	const minRam = Number(ns.args[1] ?? 8)

	const money = ns.getServerMoneyAvailable("home")
	const budget = Math.max(0, money - reserve) / ns.cloud.getServerLimit() * Number(ns.args[2] ?? 1)
	ns.tprint(`Upgrade servers with budget $${ns.format.number(budget)}.`)

	const worst = worstPurchasedServer(ns)
	if (!worst) {
		ns.tprint("No purchased servers found.")
		return
	}

	const { best: ram, nextCost } = nextAffordableRamUpgrade(ns, worst.host, budget, minRam)
	if (ram <= 0) {
		ns.tprint("Cannot afford any upgrade.")
		return
	}

	if (ram <= worst.ram) {
		ns.tprint(`No worthwhile upgrade. Worst=${worst.host} ${ns.format.ram(worst.ram)}, nextCost=${ns.format.number(nextCost)}`)
		return
	}

	const cost = ns.cloud.getServerUpgradeCost(worst.host, ram)
	ns.tprint(`Upgrading ${worst.host} from ${ns.format.ram(worst.ram)} -> ${ns.format.ram(ram)} for ${ns.format.number(cost)}`)

	const succuss = ns.cloud.upgradeServer(worst.host, ram)
	if (!succuss) {
		ns.tprint(`[FAIL] Could not upgrade ${worst.host} to ${ns.format.ram(ram)}`)
		return
	}

	ns.tprint(`[UPGRADED] ${worst.host} now ${ns.format.ram(ram)}`)
}
