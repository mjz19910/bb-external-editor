import { NetworkNode } from "./types"

const DB_PATH = "data/network_map.json"



// ----------------------------
// safe scan
// ----------------------------
function safeScan(ns: NS, host: string): string[] {
	try {
		if (!host || !ns.serverExists(host)) return []
		return ns.scan(host)
	} catch {
		return []
	}
}

export class NetworkMap {
	allHosts: string[] = []
	nodes: Record<string, NetworkNode> = {}

	constructor(public root: string | null = null) { }

	// ----------------------------
	// persistence
	// ----------------------------
	private save(ns: NS, path = DB_PATH) {
		const json_txt = JSON.stringify(this, null, "\t")
		ns.write(path, json_txt, "w")
	}

	private load(ns: NS, path = DB_PATH) {
		if (!ns.fileExists(path)) return
		const json_txt = ns.read(path)
		if (!json_txt) return

		let raw: NetworkMap
		try {
			raw = JSON.parse(json_txt)
		} catch {
			return
		}

		const net_map = raw
		this.root = net_map.root
		this.nodes = net_map.nodes
		this.allHosts = net_map.allHosts
	}

	scanAll(ns: NS) {
		if (!this.root) return

		this.allHosts = []
		this.nodes = {}

		const start = this.root
		const queue: string[] = [start]
		const seen = new Set<string>([start])

		this.nodes[start] = {
			host: start,
			parent: null,
			depth: 0,
			neighbors: safeScan(ns, start)
		}

		while (queue.length > 0) {
			const host = queue.shift()!
			const depth = this.nodes[host].depth
			const neighbors = safeScan(ns, host)

			for (const next of neighbors) {
				if (seen.has(next)) continue
				seen.add(next)
				this.allHosts.push(next)
				this.nodes[next] = {
					host: next,
					parent: host,
					depth: depth + 1,
					neighbors: safeScan(ns, next)
				}
				queue.push(next)
			}
		}
	}

	// ----------------------------
	// builders
	// ----------------------------
	static build(ns: NS) {
		const map = new NetworkMap()
		map.load(ns, DB_PATH)
		map.scanAll(ns)
		map.save(ns)
		return map
	}

	pathTo(host: string) {
		if (!this.nodes[host]) return null
		const path: string[] = []
		let cur: string | null = host
		while (cur) {
			path.push(cur)
			cur = this.nodes[cur]?.parent ?? null
		}
		path.reverse()
		return path
	}

	connectString(host: string) {
		const path = this.pathTo(host)
		if (!path) return null
		return path.map(h => `connect ${h};`).join(" ")
	}
}
