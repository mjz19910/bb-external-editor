import { NS } from "../@ns"

/** /cloud/bootstrap_cloud.ts */
export async function main(ns: NS) {
	ns.disableLog("ALL")
	ns.ui.openTail()

	const START_RAM = 1
	const UPGRADE_SCRIPT = "/cloud/upgrade.ts"
	const limit = ns.cloud.getServerLimit()

	const calcWidth = (chars: number) => chars * (16 / 2.5) + 3
	const calcHeight = (lines: number) => 35 + 24 * lines
	const width = calcWidth(52)
	const maxHeight = Math.max(220, ns.ui.windowSize()[1] - 160)

	let lines = 4
	ns.ui.resizeTail(width, Math.min(maxHeight, calcHeight(lines)))
	ns.ui.moveTail(280, 70)

	const getName = (index: number) =>
		`worker-${String(index + 1).padStart(2, "0")}`

	ns.print(`server limit: ${limit}`)
	lines++
	ns.print("waiting to bootstrap...")
	lines++

	const costPerServer = ns.cloud.getServerCost(START_RAM)
	if (costPerServer < 0) {
		ns.print("invalid cost for 1 GB")
		return
	}

	const fullTierCost = costPerServer * limit

	ns.print(`1 GB per server cost: ${ns.format.number(costPerServer)}`)
	ns.print(`full tier cost: ${ns.format.number(fullTierCost)}`)
	lines += 2

	while (true) {
		const hosts = ns.cloud.getServerNames()
		if (hosts.length >= limit) {
			ns.print(`already full (${hosts.length}/${limit})`)
			lines++
			break
		}

		const liveMoney = ns.getServerMoneyAvailable("home")
		if (liveMoney < fullTierCost) {
			ns.print(`not enough money for full tier, waiting... have ${ns.format.number(liveMoney)}, need ${ns.format.number(fullTierCost)}`)
			lines++
			await ns.sleep(5000)
			continue
		}

		ns.print(`purchasing full tier of ${limit} servers at ${START_RAM} GB, total cost ${ns.format.number(fullTierCost)}`)
		lines++

		for (let i = 0; i < limit; i++) {
			const name = getName(i)
			if (hosts.includes(name)) continue

			const purchased = ns.cloud.purchaseServer(name, START_RAM)
			if (!purchased) {
				ns.print("failed to purchase ", name)
				lines++
				break
			}
			ns.print("purchased ", name)
			lines++
		}

		break
	}

	ns.ui.resizeTail(width, Math.min(maxHeight, calcHeight(lines)))
	ns.ui.moveTail(280, 70)

	// Hand off to upgrade script
	const finalHosts = ns.cloud.getServerNames()
	if (finalHosts.length > 0) {
		ns.print(`spawning ${UPGRADE_SCRIPT}`)
		ns.spawn(UPGRADE_SCRIPT, 1)
	}
}
