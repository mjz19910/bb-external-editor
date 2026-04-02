import {
	applyHacknetOption,
	chooseBestHacknetOption,
	getHacknetNodes,
} from "./lib/hacknet"

export async function main(ns: NS) {
	const reserve = Number(ns.args[0] ?? 100_000)
	const minRoi = Number(ns.args[1] ?? 1e-6)
	const buyMany = Boolean(ns.args[2] ?? true)

	let bought = 0

	while (true) {
		const money = ns.getServerMoneyAvailable("home")
		const budget = money - reserve

		const best = chooseBestHacknetOption(ns)
		if (!best) {
			ns.tprint("No worthwhile Hacknet upgrade found.")
			break
		}

		if (best.roi < minRoi) {
			ns.tprint(`Best ROI too low: ${best.label} roi=${best.roi.toExponential(3)}`)
			break
		}

		if (best.cost > budget) {
			ns.tprint(`Cannot afford best option: ${best.label} cost=${ns.format.number(best.cost)} budget=${ns.format.number(budget)}`)
			break
		}

		const ok = applyHacknetOption(ns, best)
		if (!ok) {
			ns.tprint(`[FAIL] ${best.label}`)
			break
		}

		bought++
		ns.tprint(
			`[HACKNET] bought ${best.label} ` +
			`cost=${ns.format.number(best.cost)} ` +
			`gain=${best.gain.toFixed(3)}/s ` +
			`roi=${best.roi.toExponential(3)}`,
		)

		if (!buyMany) break
	}

	const nodes = getHacknetNodes(ns)
	const totalProd = nodes.reduce((sum, n) => sum + n.stats.production, 0)

	ns.tprint(`Hacknet nodes: ${nodes.length}`)
	ns.tprint(`Total production: ${totalProd.toFixed(3)}/s`)
	ns.tprint(`Upgrades bought: ${bought}`)
}
