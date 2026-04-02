import { scoreTargets } from "../lib/score_target"
import { getFarmableTargets } from "../lib/targeting"

export async function main(ns: NS) {
	ns.disableLog("ALL")

	const targets = getFarmableTargets(ns)
	const scored = scoreTargets(ns, targets, {
		hackFraction: 0.1,
		minHackChance: 0.2,
	})

	ns.tprint("=== TOP TARGETS ===")
	for (const t of scored.slice(0, 15)) {
		ns.tprint(
			[
				t.target.padEnd(22),
				`score=${fmt(t.finalScore).padStart(10)}`,
				`eff=${fmt(t.efficiencyScore).padStart(10)}`,
				`$=${ns.format.number(t.maxMoney).padStart(8)}`,
				`money=${(t.moneyPct * 100).toFixed(1).padStart(6)}%`,
				`sec+${t.secDelta.toFixed(2).padStart(6)}`,
				`chance=${(t.hackChance * 100).toFixed(1).padStart(6)}%`,
				`ram=${String(t.ramCostEstimate).padStart(6)}`,
			].join("  ")
		)
	}
}

function fmt(n: number): string {
	if (!Number.isFinite(n)) return "inf"
	if (Math.abs(n) >= 1000) return n.toFixed(0)
	if (Math.abs(n) >= 100) return n.toFixed(1)
	if (Math.abs(n) >= 10) return n.toFixed(2)
	return n.toFixed(4)
}