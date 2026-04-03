import { buildNetworkMap, pathTo } from "./lib/network_map"

export async function main(ns: NS) {
	const target = String(ns.args[0] ?? "")
	if (!target) {
		ns.tprint("Usage: run connect_path.ts <server>")
		return
	}

	const map = buildNetworkMap(ns)

	if (!map.nodes[target]) {
		ns.tprint(`Server not found: ${target}`)
		return
	}

	const fullPath = pathTo(map, target)
	const path = trimToLastBackdoored(ns, fullPath)

	ns.tprint(`Path: ${path.join(" -> ")}`)
	ns.tprint(`Connect: ${pathToConnectString(path)}`)
}

function trimToLastBackdoored(ns: NS, path: string[]): string[] {
	let lastBackdoorIndex = 0 // fallback to home

	for (let i = 0; i < path.length; i++) {
		const server = path[i]
		if (ns.getServer(server).backdoorInstalled) {
			lastBackdoorIndex = i
		}
	}

	return path.slice(lastBackdoorIndex)
}

function pathToConnectString(path: string[]): string {
	if (path.length <= 1) return "Already there"
	return path.map((server) => `connect ${server};`).join(" ")
}

export function autocomplete(d: AutocompleteData) {
	return d.servers
}
