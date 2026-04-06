// fuzz_test.ts
import { corruptNetworkMap } from "../src2/lib/corrupter"
import { NetworkMap } from "../src2/NetworkMap"

export async function runFuzzTest(ns: NS, rounds = 50) {
	let homeFails = 0
	let totalRootsBefore = 0
	let totalRootsAfter = 0

	// Build/load initial map
	let map = NetworkMap.build(ns, "home")
	ns.tprint(`Starting fuzz test: ${rounds} rounds`)
	ns.tprint(`Initial roots: ${map.roots.join(", ")}`)

	for (let i = 1; i <= rounds; i++) {
		// Clone map to avoid cumulative corruption if desired
		const testMap = JSON.parse(JSON.stringify(map)) as NetworkMap
		const networkMap = Object.assign(new NetworkMap(), testMap) // restore prototype

		// Corrupt the map
		corruptNetworkMap(networkMap, {
			removeParentChance: 0.3,
			addFakeNeighborChance: 0.2,
			swapParentChance: 0.2,
			removeFromRootsChance: 0.3,
		})

		totalRootsBefore += networkMap.roots.length

		// Repair: refresh all roots
		for (const root of [...networkMap.roots]) {
			networkMap.refreshSubtree(ns, root)
		}

		totalRootsAfter += networkMap.roots.length

		// Check if "home" survived
		if (!networkMap.roots.includes("home")) {
			homeFails++
			ns.tprint(`[FAIL][Round ${i}] Home missing from roots! Roots: ${networkMap.roots.join(", ")}`)
		} else {
			ns.tprint(`[PASS][Round ${i}] Home preserved`)
		}
	}

	ns.tprint("===== Fuzz Test Summary =====")
	ns.tprint(`Total rounds: ${rounds}`)
	ns.tprint(`Home lost in: ${homeFails} rounds (${((homeFails / rounds) * 100).toFixed(1)}%)`)
	ns.tprint(`Average roots before repair: ${(totalRootsBefore / rounds).toFixed(2)}`)
	ns.tprint(`Average roots after repair: ${(totalRootsAfter / rounds).toFixed(2)}`)
}

export async function main(ns: NS) {
	await runFuzzTest(ns, 8)
}
