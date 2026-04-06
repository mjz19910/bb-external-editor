import { HacknetUpgradeKind, HacknetManager } from "../lib/hacknet"

function parseKinds(raw: string): HacknetUpgradeKind[] | undefined {
	if (!raw) return undefined

	const allowed = new Set<HacknetUpgradeKind>([
		"new",
		"level",
		"ram",
		"core",
		"cache",
	])

	const out = raw
		.split(",")
		.map((s) => s.trim().toLowerCase())
		.filter((s): s is HacknetUpgradeKind => allowed.has(s as HacknetUpgradeKind))

	return out.length > 0 ? out : undefined
}

export async function main(ns: NS) {
	const hacknet = new HacknetManager(ns)

	const reserve = Number(ns.args[0] ?? 0)
	const spendFraction = Number(ns.args[1] ?? 1)
	const loop = Boolean(ns.args[2] ?? false)
	const sleepMs = Number(ns.args[3] ?? 30_000)

	const maxPaybackSeconds = Number(ns.args[4] ?? 3600) // default 1 hour
	const minRoi = Number(ns.args[5] ?? 0)
	const allowKinds = parseKinds(String(ns.args[6] ?? ""))

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
		ns.tprint(`Max Payback: ${ns.format.time(maxPaybackSeconds * 1000)}`)
		ns.tprint(`Min ROI: ${minRoi}`)
		if (allowKinds?.length) {
			ns.tprint(`Allowed kinds: ${allowKinds.join(", ")}`)
		}

		if (budget <= 0) {
			ns.tprint("No Hacknet budget available.")
		} else {
			const best = hacknet.chooseBestOption(budget, {
				minRoi,
				maxPaybackSeconds,
				allowKinds,
			})

			if (!best) {
				ns.tprint("No acceptable Hacknet upgrade found.")
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
