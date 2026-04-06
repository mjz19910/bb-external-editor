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
	const f = ns.flags([["loop", false]]) as { loop?: boolean, _: ScriptArg[] }
	const args = f._

	const loop = Boolean(f.loop ?? false)

	const reserve = Number(args[0] ?? 0)
	const spendFraction = Number(args[1] ?? 0.08)
	const sleepMs = Number(args[2] ?? 30_000)

	const maxPaybackSeconds = Number(args[3] ?? 3600) // default 1 hour
	const minRoi = Number(args[4] ?? 0)
	const allowKinds = parseKinds(String(args[5] ?? ""))

	do {
		let do_short_sleep = false

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
