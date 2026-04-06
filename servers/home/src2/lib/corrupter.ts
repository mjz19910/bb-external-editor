import { NetworkMap } from "../NetworkMap"

export function corruptNetworkMap(map: NetworkMap, options?: {
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
			console.log(`[corrupt] Dropping parent of ${host} (was ${node.parent})`)
			node.parent = null
			node.depth = 0
			if (!map.roots.includes(host)) map.roots.push(host)
		}

		// randomly swap parent
		if (node.parent && Math.random() < opts.swapParentChance) {
			const newParent = hosts[Math.floor(Math.random() * hosts.length)]
			console.log(`[corrupt] Swapping parent of ${host} from ${node.parent} → ${newParent}`)
			node.parent = newParent
			node.depth = map.nodes[newParent]?.depth + 1
		}

		// randomly add fake neighbor
		if (Math.random() < opts.addFakeNeighborChance) {
			const fakeNeighbor = `FAKE-${Math.floor(Math.random() * 1000)}`
			console.log(`[corrupt] Adding fake neighbor ${fakeNeighbor} to ${host}`)
			node.neighbors.push(fakeNeighbor)
		}
	}

	// randomly remove some roots
	map.roots = map.roots.filter(r => {
		if (Math.random() < opts.removeFromRootsChance) {
			console.log(`[corrupt] Removing ${r} from roots`)
			return false
		}
		return true
	})
}
