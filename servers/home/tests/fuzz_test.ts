// fuzz_test.ts
import { advancedCorruptNetworkMap, corruptNetworkMap } from "../src2/lib/corrupter"
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
		corruptNetworkMap(ns, networkMap, {
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

export async function runAdvancedFuzzTest(ns: NS, rounds = 100) {
	let homeFails = 0
	let totalRootsBefore = 0
	let totalRootsAfter = 0

	// Step 1: Build/load initial map
	const originalMap = NetworkMap.build(ns, "home")
	ns.tprint(`Starting advanced fuzz test: ${rounds} rounds`)
	ns.tprint(`Initial roots: ${originalMap.roots.join(", ")}`)

	for (let i = 1; i <= rounds; i++) {
		// Clone map for independent corruption
		const mapData = JSON.parse(JSON.stringify(originalMap))
		const map = Object.assign(new NetworkMap(), mapData) as NetworkMap

		// Step 2: Corrupt the map
		advancedCorruptNetworkMap(ns, map, {
			removeParentChance: 0.3,
			addFakeNeighborChance: 0.2,
			swapParentChance: 0.2,
			removeFromRootsChance: 0.3,
			removeNodeChance: 0.05,
			edgeSwapChance: 0.05,
		})

		totalRootsBefore += map.roots.length

		// Step 3: Repair map
		const rootsToRefresh = [...new Set(["home", ...map.roots])]
		for (const root of rootsToRefresh) {
			map.refreshSubtree(ns, root)
		}

		totalRootsAfter += map.roots.length

		// Step 4: Check if home survived
		if (!map.roots.includes("home")) {
			homeFails++
			ns.tprint(`[FAIL][Round ${i}] Home missing from roots! Roots: ${map.roots.join(", ")}`)
		} else {
			ns.tprint(`[PASS][Round ${i}] Home preserved`)
		}

		map.save(ns, `data/bad/map_${i}.json`)
	}

	// Step 5: Summary
	ns.tprint("===== Advanced Fuzz Test Summary =====")
	ns.tprint(`Total rounds: ${rounds}`)
	ns.tprint(`Home lost in: ${homeFails} rounds (${((homeFails / rounds) * 100).toFixed(1)}%)`)
	ns.tprint(`Average roots before repair: ${(totalRootsBefore / rounds).toFixed(2)}`)
	ns.tprint(`Average roots after repair: ${(totalRootsAfter / rounds).toFixed(2)}`)
}

export async function main(ns: NS) {
	await runAdvancedFuzzTest(ns, 150)
}
