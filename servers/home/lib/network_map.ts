import { NS } from "./@ns";

export type NetworkNode = {
	host: string;
	parent: string | null;
	depth: number;
	neighbors: string[];
};

export class NetworkMap {
	constructor(
		public hosts: string[] = [],
		public nodes: Record<string, NetworkNode> = {},
		public ramSizes: Record<string, number> = {},
	) {}
	getRamInfo(ns: NS, host: string) {
		const maxRam = this.ramSizes[host];
		const usedRam = ns.getServerUsedRam(host);
		const free = maxRam - usedRam;
		return {
			host,
			maxRam,
			usedRam,
			freeRam: free,
		};
	}
	findBestTarget(ns: NS) {
		const myHacking = ns.getHackingLevel();
		const map = this;

		let best = null;
		let bestValue = 0;

		for (const s of map.hosts) {
			if (s === "home") continue;
			if (!ns.hasRootAccess(s)) continue;
			if (ns.getServerRequiredHackingLevel(s) > (myHacking / 2) + 2) {
				continue;
			}

			const maxMoney = ns.getServerMaxMoney(s);
			if (maxMoney <= 0) continue;

			const reqHack = ns.getServerRequiredHackingLevel(s);
			const minSec = ns.getServerMinSecurityLevel(s);
			const growth = ns.getServerGrowth(s);
			const score = (maxMoney * growth) / Math.max(1, minSec * reqHack);

			if (score > bestValue) {
				bestValue = score;
				best = s;
			}
		}

		return best;
	}
	addNodes(ns: NS, parent: string, hosts: string[]) {
		const pn = this.nodes[parent];
		for (const host of hosts) {
			this.nodes[host] = {
				host,
				parent,
				depth: pn.depth + 1,
				neighbors: ns.scan(host),
			};
			this.hosts.push(host);
			this.ramSizes[host] = ns.getServerMaxRam(host);
		}
		this.hosts.sort();
		const json_txt = JSON.stringify(this, void 0, "\t");
		ns.write(DB_PATH, json_txt, "w");
	}
	static build(ns: NS, start = "home") {
		return buildNetworkMap(ns, start);
	}
}

const DB_PATH = "gpt_pause/src/db/network_map.json";
let saved_map_invalid = false;
let network_map: NetworkMap | null = null;

export function buildNetworkMap(ns: NS, start = "home"): NetworkMap {
	x: if (network_map) {
		const hosts = network_map.hosts;
		const nodes = network_map.nodes;
		const hosts_len = hosts.length;
		const recheck_idx = Math.floor(Math.random() * hosts_len);
		const check_host = hosts[recheck_idx];
		const scan_results = ns.scan(check_host);
		const nn = nodes[check_host];
		if (scan_results.length != nn.neighbors.length) {
			network_map = null;
			saved_map_invalid = true;
			break x;
		}
		return network_map;
	}
	x: if (!saved_map_invalid && ns.fileExists(DB_PATH)) {
		const json_txt = ns.read(DB_PATH);
		const net_map: NetworkMap = JSON.parse(json_txt);
		if (!("ramSizes" in net_map)) {
			break x;
		}
		network_map = new NetworkMap();
		network_map.hosts = net_map.hosts;
		network_map.nodes = net_map.nodes;
		network_map.ramSizes = net_map.ramSizes;
		return network_map;
	}
	const nodes: Record<string, NetworkNode> = {};
	const queue: string[] = [start];
	const seen = new Set<string>([start]);

	nodes[start] = {
		host: start,
		parent: null,
		depth: 0,
		neighbors: ns.scan(start),
	};

	while (queue.length > 0) {
		const host = queue.shift()!;
		const depth = nodes[host].depth;

		for (const next of ns.scan(host)) {
			if (seen.has(next)) continue;
			seen.add(next);

			nodes[next] = {
				host: next,
				parent: host,
				depth: depth + 1,
				neighbors: ns.scan(next),
			};

			queue.push(next);
		}
	}

	const hosts = Object.keys(nodes).sort();
	const ramSizes: Record<string, number> = {};
	for (const host of hosts) {
		ramSizes[host] = ns.getServerMaxRam(host);
	}
	network_map = new NetworkMap(hosts, nodes, ramSizes);
	const json_txt = JSON.stringify(network_map, void 0, "\t");
	ns.write(DB_PATH, json_txt, "w");
	return network_map;
}

export function pathTo(map: NetworkMap, target: string): string[] {
	if (!map.nodes[target]) return [];

	const path: string[] = [];
	let cur: string | null = target;

	while (cur !== null) {
		path.push(cur);
		cur = map.nodes[cur]?.parent ?? null;
	}

	return path.reverse();
}

export function connectString(map: NetworkMap, target: string): string {
	return pathTo(map, target)
		.slice(1)
		.map((h) => `connect ${h}`)
		.join("; ");
}

export function childrenOf(map: NetworkMap, host: string): string[] {
	return map.hosts.filter((h) => map.nodes[h].parent === host);
}

export function leafHosts(map: NetworkMap): string[] {
	return map.hosts.filter((h) =>
		h !== "home" && map.nodes[h].neighbors.length === 1
	);
}

export function hubHosts(map: NetworkMap): { host: string; degree: number }[] {
	return map.hosts
		.map((host) => ({ host, degree: map.nodes[host].neighbors.length }))
		.sort((a, b) => b.degree - a.degree);
}

export type ServerClass = "farmable" | "rootable" | "future" | "useless";

export function countPortOpeners(ns: NS): number {
	let count = 0;
	if (ns.fileExists("BruteSSH.exe", "home")) count++;
	if (ns.fileExists("FTPCrack.exe", "home")) count++;
	if (ns.fileExists("relaySMTP.exe", "home")) count++;
	if (ns.fileExists("HTTPWorm.exe", "home")) count++;
	if (ns.fileExists("SQLInject.exe", "home")) count++;
	return count;
}

export function classifyServer(ns: NS, host: string): ServerClass {
	if (host === "home") return "useless";

	const rooted = ns.hasRootAccess(host);
	const reqHack = ns.getServerRequiredHackingLevel(host);
	const reqPorts = ns.getServerNumPortsRequired(host);
	const maxMoney = ns.getServerMaxMoney(host);

	const myHack = ns.getHackingLevel();
	const myPorts = countPortOpeners(ns);

	if (!rooted && reqHack <= myHack && reqPorts <= myPorts) return "rootable";
	if (rooted && maxMoney > 0 && reqHack <= myHack / 2) return "farmable";
	if (maxMoney <= 0) return "useless";
	return "future";
}

export type ServerSnapshot = {
	host: string;
	rooted: boolean;
	reqHack: number;
	reqPorts: number;
	maxMoney: number;
	money: number;
	minSec: number;
	sec: number;
	maxRam: number;
	usedRam: number;
	growth: number;
};

export function snapshotServer(
	ns: NS,
	map: NetworkMap,
	host: string,
): ServerSnapshot {
	return {
		host,
		rooted: ns.hasRootAccess(host),
		reqHack: ns.getServerRequiredHackingLevel(host),
		reqPorts: ns.getServerNumPortsRequired(host),
		maxMoney: ns.getServerMaxMoney(host),
		money: ns.getServerMoneyAvailable(host),
		minSec: ns.getServerMinSecurityLevel(host),
		sec: ns.getServerSecurityLevel(host),
		maxRam: map.ramSizes[host],
		usedRam: ns.getServerUsedRam(host),
		growth: ns.getServerGrowth(host),
	};
}

export function rootedHosts(ns: NS, hosts: string[]): string[] {
	return hosts.filter((h) => ns.hasRootAccess(h));
}

export function runnableHosts(
	ns: NS,
	map: NetworkMap,
	hosts: string[],
): string[] {
	return hosts.filter((h) => ns.hasRootAccess(h) && map.ramSizes[h] > 0);
}

export function canRunThreads(
	ns: NS,
	map: NetworkMap,
	host: string,
	script: string,
): number {
	const ram = ns.getScriptRam(script, "home");
	if (ram <= 0) return 0;
	const ri = map.getRamInfo(ns, host);
	return Math.floor(ri.freeRam / ram);
}
