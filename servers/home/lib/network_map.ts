export type NetworkNode = {
	host: string;
	parent: string | null;
	depth: number;
	neighbors: string[];
};

export type NetworkMap = {
	hosts: string[];
	nodes: Record<string, NetworkNode>;
};

export function buildNetworkMap(ns: NS, start = "home"): NetworkMap {
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
	return { hosts, nodes };
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

export function snapshotServer(ns: NS, host: string): ServerSnapshot {
	return {
		host,
		rooted: ns.hasRootAccess(host),
		reqHack: ns.getServerRequiredHackingLevel(host),
		reqPorts: ns.getServerNumPortsRequired(host),
		maxMoney: ns.getServerMaxMoney(host),
		money: ns.getServerMoneyAvailable(host),
		minSec: ns.getServerMinSecurityLevel(host),
		sec: ns.getServerSecurityLevel(host),
		maxRam: ns.getServerMaxRam(host),
		usedRam: ns.getServerUsedRam(host),
		growth: ns.getServerGrowth(host),
	};
}

export function rootedHosts(ns: NS, hosts: string[]): string[] {
	return hosts.filter((h) => ns.hasRootAccess(h));
}

export function runnableHosts(ns: NS, hosts: string[]): string[] {
	return hosts.filter((h) =>
		ns.hasRootAccess(h) && ns.getServerMaxRam(h) > 0
	);
}

export function freeRam(ns: NS, host: string): number {
	return ns.getServerMaxRam(host) - ns.getServerUsedRam(host);
}

export function canRunThreads(ns: NS, host: string, script: string): number {
	const ram = ns.getScriptRam(script, "home");
	if (ram <= 0) return 0;
	return Math.floor(freeRam(ns, host) / ram);
}
