import { advancedCorruptNetworkMap } from "../src2/lib/corrupter"
import { NetworkMap } from "../src2/NetworkMap"

export async function runFuzzTestWithDiagnostics(ns: NS, rounds = 50) {
	let homeFails = 0
	let cyclesDetected = 0
	let orphansDetected = 0

	const originalMap = NetworkMap.build(ns, "home")
	ns.tprint(`Starting diagnostic fuzz test: ${rounds} rounds`)
	ns.tprint(`Initial roots: ${originalMap.roots.join(", ")}`)

	for (let i = 1; i <= rounds; i++) {
		// Clone map for independent corruption
		const mapData = JSON.parse(JSON.stringify(originalMap))
		const map = Object.assign(new NetworkMap(), mapData) as NetworkMap

		// --- Step 1: Corrupt the map ---
		advancedCorruptNetworkMap(ns, map, {
			removeParentChance: 0.3 / map.allHosts.length * 4,
			addFakeNeighborChance: 0.2 / map.allHosts.length * 4,
			swapParentChance: 0.2 / map.allHosts.length * 4,
			removeFromRootsChance: 0.3 / map.allHosts.length * 4,
			removeNodeChance: 0.05 / map.allHosts.length * 4,
			edgeSwapChance: 0.05 / map.allHosts.length * 4,
		})

		// --- Step 2: Diagnose corruption before repair ---
		ns.tprint(`\n[Round ${i}] Diagnosing corrupted graph...`)
		map.logDiagnostics(ns, "BeforeRepair")

		// --- Step 3: Repair map ---
		const rootsToRefresh = [...new Set(["home", ...map.roots])]
		for (const root of rootsToRefresh) {
			map.refreshSubtree(ns, root)
		}

		// --- Step 4: Diagnose after repair ---
		ns.tprint(`[Round ${i}] Diagnosing repaired graph...`)
		map.logDiagnostics(ns, "AfterRepair")

		// --- Step 5: Validation ---
		const issues = map.diagnoseGraph()
		if (!map.roots.includes("home")) homeFails++
		cyclesDetected += issues.filter(i => i.includes("[cycle]")).length
		orphansDetected += issues.filter(i => i.includes("[orphan]")).length

		const validGraph = issues.length === 0
		ns.tprint(`[Round ${i}] Graph valid: ${validGraph ? "✅" : "❌"}\n`)
	}

	// --- Step 6: Summary ---
	ns.tprint("===== Diagnostic Fuzz Test Summary =====")
	ns.tprint(`Total rounds: ${rounds}`)
	ns.tprint(`Home missing from roots: ${homeFails} rounds`)
	ns.tprint(`Cycles detected across all rounds: ${cyclesDetected}`)
	ns.tprint(`Orphans detected across all rounds: ${orphansDetected}`)
}

export async function main(ns: NS) {
	await runFuzzTestWithDiagnostics(ns, 150)
}
