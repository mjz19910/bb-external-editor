import { NetworkMap } from "../NetworkMap"

export function corruptNetworkMap(ns: NS, map: NetworkMap, options?: {
	removeParentChance?: number, // chance to drop parent link
	addFakeNeighborChance?: number, // chance to add a fake neighbor
	swapParentChance?: number, // chance to swap parent to another host
	removeFromRootsChance?: number, // chance to remove a root
}) {
	const opts = {
		removeParentChance: 0.1,
		addFakeNeighborChance: 0.05,
		swapParentChance: 0.05,
		removeFromRootsChance: 0.1,
		...options,
	}

	const hosts = map.allHosts

	for (const host of hosts) {
		const node = map.nodes[host]
		if (!node) continue

		// randomly drop parent
		if (node.parent && Math.random() < opts.removeParentChance) {
			ns.tprint(`[corrupt] Dropping parent of ${host} (was ${node.parent})`)
			node.parent = null
			node.depth = 0
			if (!map.roots.includes(host)) map.roots.push(host)
		}

		// randomly swap parent
		if (node.parent && Math.random() < opts.swapParentChance) {
			const newParent = hosts[Math.floor(Math.random() * hosts.length)]
			ns.tprint(`[corrupt] Swapping parent of ${host} from ${node.parent} → ${newParent}`)
			node.parent = newParent
			node.depth = map.nodes[newParent]?.depth + 1
		}

		// randomly add fake neighbor
		if (Math.random() < opts.addFakeNeighborChance) {
			const fakeNeighbor = `FAKE-${Math.floor(Math.random() * 1000)}`
			ns.tprint(`[corrupt] Adding fake neighbor ${fakeNeighbor} to ${host}`)
			node.neighbors.push(fakeNeighbor)
		}
	}

	// randomly remove some roots
	map.roots = map.roots.filter(r => {
		if (Math.random() < opts.removeFromRootsChance) {
			ns.tprint(`[corrupt] Removing ${r} from roots`)
			return false
		}
		return true
	})
}

export function advancedCorruptNetworkMap(map: NetworkMap, options?: {
	removeParentChance?: number, // chance to drop parent link
	addFakeNeighborChance?: number, // chance to add a fake neighbor
	// chat gpt can't create and fix this one
	// swapParentChance?: number, // chance to swap parent to another host
	removeFromRootsChance?: number, // chance to remove a root
	removeNodeChance?: number,      // new: delete node entirely
	edgeSwapChance?: number,         // new: swap arbitrary edges
}) {
	const opts = {
		removeParentChance: 0.1,
		addFakeNeighborChance: 0.05,
		// chat gpt can't create and fix this one
		// swapParentChance: 0.05,
		removeFromRootsChance: 0.1,
		removeNodeChance: 0.05,
		edgeSwapChance: 0.05,
		...options,
	}

	const hosts = [...map.allHosts]

	for (const host of hosts) {
		const node = map.nodes[host]
		if (!node) continue

		// randomly drop parent
		if (node.parent && Math.random() < opts.removeParentChance) {
			node.parent = null
			node.depth = 0
		}

		// randomly add fake neighbor
		if (Math.random() < opts.addFakeNeighborChance) {
			const fakeNeighbor = `FAKE-${Math.floor(Math.random() * 1000)}`
			node.neighbors.push(fakeNeighbor)
		}

		// randomly remove node entirely
		if (Math.random() < opts.removeNodeChance && host !== "home") {
			delete map.nodes[host]
			map.allHosts = map.allHosts.filter(h => h !== host)
			map.roots = map.roots.filter(r => r !== host)
		}

		// randomly swap edges (parent-child)
		if (Math.random() < opts.edgeSwapChance) {
			const swapWith = hosts[Math.floor(Math.random() * hosts.length)]
			if (swapWith !== host && map.nodes[swapWith]) {
				const tmpParent = node.parent
				node.parent = map.nodes[swapWith].parent
				map.nodes[swapWith].parent = tmpParent
			}
		}
	}

	// randomly remove some roots
	map.roots = map.roots.filter(r => {
		if (Math.random() < opts.removeFromRootsChance && r !== "home") {
			return false
		}
		return true
	})
}
