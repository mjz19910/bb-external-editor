import { NetworkMap } from "./network_map";

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

export function getFleet(ns: NS): Fleet {
	const map = NetworkMap.build(ns);
	const purchased = new Set(ns.cloud.getServerNames());
	const hosts: FleetHost[] = map.hosts
		.filter((h) => ns.hasRootAccess(h) && map.ramSizes[h] > 0)
		.map((host) => map.getRamInfo(ns, host))
		.sort((a, b) => {
			const aP = purchased.has(a.host) ? 1 : 0;
			const bP = purchased.has(b.host) ? 1 : 0;

			if (aP !== bP) return bP - aP; // purchased first
			return b.maxRam - a.maxRam;
		});

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
	const ri = map.getRamInfo(ns, host);
	return Math.floor(ri.freeRam / ram);
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
	fleet: Fleet,
	ramPerThread: number,
	wantedThreads: number,
	reserveHomeRam = 32,
): Allocation[] {
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

export function deployScriptSet(
	ns: NS,
	files: string[],
	hosts: string[],
) {
	for (const host of hosts) {
		if (host === "home") continue;
		const scripts = ns.ls(host, ".ts");
		for (const file of scripts) {
			ns.rm(file, host);
		}
		ns.scp(files, host, "home");
	}
}

export function runAllocations(
	ns: NS,
	script: string,
	allocs: Allocation[],
	args: (string | number | boolean)[] = [],
): number {
	let launched = 0;

	for (const a of allocs) {
		if (a.threads <= 0) continue;
		const pid = ns.exec(script, a.host, a.threads, ...args);
		if (pid !== 0) launched += a.threads;
	}

	return launched;
}

export type LaunchResult = {
	threads: number;
	pids: number[];
};

export function runAllocationsTracked(
	ns: NS,
	script: string,
	allocs: Allocation[],
	args: ScriptArg[] = [],
): LaunchResult {
	let threads = 0;
	const pids: number[] = [];

	for (const a of allocs) {
		if (a.threads <= 0) continue;

		const pid = ns.exec(script, a.host, a.threads, ...args);
		if (pid === 0) continue;

		threads += a.threads;
		pids.push(pid);
	}

	return { threads, pids };
}
