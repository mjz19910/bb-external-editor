import { NS } from "../@ns";
import { buildNetworkMap, freeRam, NetworkMap } from "./network_map";

export type FleetHost = {
	host: string;
	maxRam: number;
	usedRam: number;
	freeRam: number;
};

export type Fleet = {
	hosts: FleetHost[];
	totalMaxRam: number;
	totalUsedRam: number;
	totalFreeRam: number;
};

export function getFleet(ns: NS, map: NetworkMap): Fleet {
	const hosts: FleetHost[] = map.hosts
		.filter((h) => ns.hasRootAccess(h) && map.ramSizes[h] > 0)
		.map((host) => {
			const maxRam = map.ramSizes[host];
			const usedRam = ns.getServerUsedRam(host);
			const free = freeRam(ns, map, host);

			return {
				host,
				maxRam,
				usedRam,
				freeRam: free,
			};
		})
		.sort((a, b) => b.freeRam - a.freeRam);

	let totalMaxRam = 0;
	let totalUsedRam = 0;
	let totalFreeRam = 0;

	for (const h of hosts) {
		totalMaxRam += h.maxRam;
		totalUsedRam += h.usedRam;
		totalFreeRam += h.freeRam;
	}

	return {
		hosts,
		totalMaxRam,
		totalUsedRam,
		totalFreeRam,
	};
}

export function maxThreadsForScript(
	ns: NS,
	map: NetworkMap,
	host: string,
	script: string,
): number {
	const ram = ns.getScriptRam(script, "home");
	if (ram <= 0) return 0;
	return Math.floor(freeRam(ns, map, host) / ram);
}

export function totalThreadsForScript(
	ns: NS,
	map: NetworkMap,
	fleet: Fleet,
	script: string,
): number {
	return fleet.hosts.reduce(
		(sum, h) => sum + maxThreadsForScript(ns, map, h.host, script),
		0,
	);
}

export type Allocation = {
	host: string;
	threads: number;
};

export function allocateThreads(
	ns: NS,
	fleet: Fleet,
	script: string,
	wantedThreads: number,
	reserveHomeRam = 32,
): Allocation[] {
	const ramPerThread = ns.getScriptRam(script, "home");
	if (ramPerThread <= 0 || wantedThreads <= 0) return [];

	const allocations: Allocation[] = [];
	let remaining = wantedThreads;

	for (const h of fleet.hosts) {
		let free = h.freeRam;

		if (h.host === "home") {
			free = Math.max(0, free - reserveHomeRam);
		}

		const threads = Math.floor(free / ramPerThread);
		if (threads <= 0) continue;

		const use = Math.min(threads, remaining);
		if (use <= 0) continue;

		allocations.push({
			host: h.host,
			threads: use,
		});

		remaining -= use;
		if (remaining <= 0) break;
	}

	return allocations;
}

export async function deployScriptSet(
	ns: NS,
	files: string[],
	hosts: string[],
) {
	for (const host of hosts) {
		if (host === "home") continue;
		ns.scp(files, host, "home");
	}
}

export function runAllocations(
	ns: NS,
	script: string,
	allocations: Allocation[],
	args: (string | number | boolean)[] = [],
): number {
	let launched = 0;

	for (const a of allocations) {
		if (a.threads <= 0) continue;
		const pid = ns.exec(script, a.host, a.threads, ...args);
		if (pid !== 0) launched += a.threads;
	}

	return launched;
}
