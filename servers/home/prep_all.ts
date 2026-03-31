/** prep_all.ts
 * Grow all rooted servers to max money and reduce to min security.
 *
 * Usage:
 *   run prep_all.ts
 *   run prep_all.ts --reserve 32
 */
import { buildNetworkMap } from "./lib/network_map";

function formatMoney(ns: NS, n: number) {
	return "$" + ns.format.number(n, 2);
}

const all_scripts = [
	"lib/prep_weak.ts",
	"lib/prep_grow.ts",
];
export async function main(ns: NS) {
	function log(...args: any[]) {
		ns.tprint(...args);
		ns.print(...args);
	}

	ns.disableLog("ALL");
	ns.clearLog();

	const reserve = ns.args.includes("--reserve")
		? Number(ns.args[ns.args.indexOf("--reserve") + 1] ?? 32)
		: 32;
	const map = buildNetworkMap(ns);
	const hosts = map.hosts.filter((h) => ns.hasRootAccess(h));
	for (const host of hosts) {
		if (host != "home") {
			ns.scp(all_scripts, host);
		}
	}

	const maxRamByHost = new Map<string, number>();
	const serverMaxMoneyMap = new Map<string, number>();
	const serverMinSecMap = new Map<string, number>();
	const scriptRamMap = new Map<string, number>();

	for (const host of hosts) {
		maxRamByHost.set(host, map.ramSizes[host]);
	}

	for (const target of hosts) {
		serverMaxMoneyMap.set(target, ns.getServerMaxMoney(target));
		serverMinSecMap.set(target, ns.getServerMinSecurityLevel(target));
	}

	hosts.sort((a, b) => serverMinSecMap.get(a)! - serverMinSecMap.get(b)!);

	const weaken1 = ns.weakenAnalyze(1);

	function getPrepSortKey(ns: NS, target: string): number {
		const maxMoney = serverMaxMoneyMap.get(target)!;
		const money = Math.max(1, ns.getServerMoneyAvailable(target));
		const sec = serverMinSecMap.get(target)!;
		const minSec = ns.getServerMinSecurityLevel(target);

		const weakenThreads = Math.ceil(Math.max(0, sec - minSec) / weaken1);

		const growThreads = money >= maxMoney
			? 0
			: Math.ceil(ns.growthAnalyze(target, maxMoney / money));

		const weakenForGrow = Math.ceil(
			ns.growthAnalyzeSecurity(growThreads, target) / weaken1,
		);

		const weakenTime = ns.getWeakenTime(target);
		const growTime = ns.getGrowTime(target);

		return weakenThreads * weakenTime +
			growThreads * growTime * 0.05 +
			weakenForGrow * weakenTime;
	}

	const targets = hosts
		.filter((h) => h !== "home" && serverMaxMoneyMap.get(h)! > 0)
		.sort((a, b) => getPrepSortKey(ns, a) - getPrepSortKey(ns, b));

	log(`Preparing ${targets.length} servers in parallel...`);

	const done = new Set<string>();

	while (done.size < targets.length) {
		for (const target of targets) {
			if (done.has(target)) continue;

			const money = ns.getServerMoneyAvailable(target);
			const sec = ns.getServerSecurityLevel(target);
			const maxMoney = serverMaxMoneyMap.get(target)!;
			const minSec = serverMinSecMap.get(target)!;

			const moneyReady = money >= maxMoney;
			const secReady = sec <= minSec + 0.001;

			if (!secReady) {
				const launched = await launchAcrossNetwork(
					ns,
					"gpt_pause/src/tmp/prep_weak.ts",
					target,
					reserve,
					hosts,
					maxRamByHost,
					scriptRamMap,
				);
				if (launched > 0) {
					const waitTime = ns.getWeakenTime(target);
					log(
						`${target}: weaken x${launched}, ETA ${
							ns.format.time(waitTime)
						}`,
					);
					// await ns.sleep(waitTime)
					await ns.sleep(5000);
				}
			} else if (!moneyReady) {
				const launched = await launchAcrossNetwork(
					ns,
					"gpt_pause/src/tmp/prep_grow.ts",
					target,
					reserve,
					hosts,
					maxRamByHost,
					scriptRamMap,
				);
				if (launched > 0) {
					const waitTime = ns.getGrowTime(target);
					log(
						`${target}: grow x${launched}, ETA ${
							ns.format.time(waitTime)
						}`,
					);
					// await ns.sleep(waitTime)
					await ns.sleep(5000);
				}
			} else {
				log(
					`${target}: READY (${formatMoney(ns, money)} / ${
						formatMoney(ns, maxMoney)
					}, sec ${sec.toFixed(2)})`,
				);
				done.add(target);
			}
		}
		await ns.sleep(5000);
	}
	log("All servers prepped.");
}

async function launchAcrossNetwork(
	ns: NS,
	script: string,
	target: string,
	reserve: number,
	hosts: string[],
	maxRamByHost: Map<string, number>,
	scriptRamMap: Map<string, number>,
) {
	if (!scriptRamMap.has(script)) {
		scriptRamMap.set(script, ns.getScriptRam(script));
	}
	const ramPerThread = scriptRamMap.get(script)!;

	const sortedHosts = hosts
		.filter((h) => ns.hasRootAccess(h) && (maxRamByHost.get(h) ?? 0) > 0)
		.sort((a, b) => (maxRamByHost.get(b)! - maxRamByHost.get(a)!));

	let sum = 0;
	for (const host of sortedHosts) {
		const maxRam = maxRamByHost.get(host)!;
		const usedRam = ns.getServerUsedRam(host);
		const freeRam = host === "home"
			? Math.max(0, maxRam - usedRam - reserve)
			: Math.max(0, maxRam - usedRam);

		const threads = Math.floor(freeRam / ramPerThread);
		if (threads <= 0) continue;

		const pid = ns.exec(script, host, threads, target, threads);
		if (pid !== 0) {
			sum += threads;
			await ns.sleep(50);
		}
	}
	return sum;
}
