import { advancedCorruptNetworkMap } from "../src2/lib/corrupter"
import { NetworkMap } from "../src2/NetworkMap"

export async function runFuzzTestWithDiagnostics(ns: NS, rounds = 50) {
	let homeFails = 0
	let cyclesDetected = 0
	let orphansDetected = 0
	let brokenLinks = 0

	const originalMap = NetworkMap.build(ns, "home")
	ns.tprint(`Starting diagnostic fuzz test: ${rounds} rounds`)
	ns.tprint(`Initial roots: ${originalMap.roots.join(", ")}`)

	for (let i = 1; i <= rounds; i++) {
		// Clone map for independent corruption
		const mapData = JSON.parse(JSON.stringify(originalMap))
		const map = Object.assign(new NetworkMap(), mapData) as NetworkMap
		// --- Step 1: Corrupt the map ---
		advancedCorruptNetworkMap(map, {
			removeParentChance: 0.3,
			addFakeNeighborChance: 0.2,
			swapParentChance: 0.2,
			removeFromRootsChance: 0.3,
			removeNodeChance: 0.05,
			edgeSwapChance: 0.05,
		})

		// --- Step 3: Repair map ---
		const rootsToRefresh = [...new Set(["home", ...map.roots])]
		for (const root of rootsToRefresh) {
			map.refreshSubtree(ns, root)
			map.healGraph()
		}

		// --- Step 5: Validation ---
		const issues = map.diagnoseGraph()
		if (!map.roots.includes("home")) homeFails++
		cyclesDetected += issues.filter(i => i.includes("[cycle]")).length
		orphansDetected += issues.filter(i => i.includes("[orphan]")).length
		brokenLinks += issues.filter(i => i.includes("[broken link]")).length

		if (issues.length > 0) {
			ns.tprint(`[Round ${i}] Graph valid: ❌`)
			for (const issue of issues) {
				ns.tprint("\t" + issue)
			}
		}
	}

	// --- Step 6: Summary ---
	ns.tprint("===== Diagnostic Fuzz Test Summary =====")
	ns.tprint(`Total rounds: ${rounds}`)
	ns.tprint(`Home missing from roots: ${homeFails} rounds`)
	ns.tprint(`Cycles detected across all rounds: ${cyclesDetected}`)
	ns.tprint(`Orphans detected across all rounds: ${orphansDetected}`)
	ns.tprint(`Broken links across all rounds: ${brokenLinks}`)
}

export async function main(ns: NS) {
	await runFuzzTestWithDiagnostics(ns, 150)
}
