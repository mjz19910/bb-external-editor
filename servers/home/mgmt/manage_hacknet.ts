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
	const maxPaybackSeconds = Number(args[2] ?? 3600)
	const minRoi = Number(args[3] ?? 0)
	const allowKinds = parseKinds(String(args[5] ?? ""))

	ns.tprint("Starting Hacknet Manager")
	ns.tprint(`Max Payback: ${ns.format.time(maxPaybackSeconds * 1000)}`)
	if (allowKinds?.length) {
		ns.tprint(`Allowed kinds: ${allowKinds.join(", ")}`)
	}

	let cur_delay = 200

	do {
		hacknet.refresh()
		const hacknet_size = hacknet.count()

		const money = ns.getServerMoneyAvailable("home")
		const available = Math.max(0, money - reserve)
		const budget = available * spendFraction

		if (reserve > 0) ns.tprint(`Reserve: ${ns.format.number(reserve)}`)
		if (minRoi > 0) ns.tprint(`Min ROI: ${minRoi}`)
		ns.tprint(`Budget: ${ns.format.number(budget)} / ${ns.format.number(money)}`)
		ns.tprint(`Hacknet: ${hacknet.count()} nodes producing ${ns.format.number(hacknet.totalProduction())}`)

		if (budget <= 0) {
			ns.tprint("No Hacknet budget available.")
		} else {
			const best = hacknet.chooseBestOption(budget, {
				minRoi,
				maxPaybackSeconds: maxPaybackSeconds * (hacknet_size + 1) * 0.5,
				allowKinds,
			})

			if (!best) {
				ns.tprint("No acceptable Hacknet upgrade found.")
				cur_delay *= 2
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

					cur_delay *= 0.85
				}
			}
		}

		if (!loop) break

		if (cur_delay > 5 * 60_000) {
			ns.tprint("Next estimated Hacknet upgrade time greater than 5 minutes, probably finished")
			break
		}

		if (cur_delay < 80) cur_delay = 80
		ns.tprint(`Delay: ${ns.format.time(cur_delay, true)}`)

		await ns.sleep(cur_delay)
	} while (true)
}
