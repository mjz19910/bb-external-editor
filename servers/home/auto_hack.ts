export async function main(ns: NS) {
	ns.disableLog("ALL");

	const host = ns.getHostname();

	const hackScript = "src/hack.ts";
	const growScript = "src/grow2.ts";
	const weakenScript = "tmp/weak.ts";

	while (true) {
		const target = findBestTarget(ns);
		if (!target) {
			ns.print("No valid target found.");
			await ns.sleep(5000);
			continue;
		}

		const money = ns.getServerMoneyAvailable(target);
		const maxMoney = ns.getServerMaxMoney(target);
		const sec = ns.getServerSecurityLevel(target);
		const minSec = ns.getServerMinSecurityLevel(target);

		const freeRam = ns.getServerMaxRam(host) - ns.getServerUsedRam(host);

		let script = weakenScript;
		let threads = 1;

		if (sec > minSec + 5) {
			script = weakenScript;
			threads = Math.floor(freeRam / ns.getScriptRam(weakenScript));
		} else if (money < maxMoney * 0.75) {
			script = growScript;
			threads = Math.floor(freeRam / ns.getScriptRam(growScript));
		} else {
			script = hackScript;
			threads = Math.floor(freeRam / ns.getScriptRam(hackScript));
		}

		if (threads < 1) {
			ns.print(`Not enough RAM to run ${script}`);
			await ns.sleep(5000);
			continue;
		}

		ns.print(`Target=${target} | Script=${script} | Threads=${threads}`);
		ns.exec(script, host, threads, target);

		await ns.sleep(1000);
	}
}

function findBestTarget(ns: NS) {
	const myHacking = ns.getHackingLevel();
	const servers = scanAll(ns);

	let best = null;
	let bestValue = 0;

	for (const s of servers) {
		if (s === "home") continue;
		if (!ns.hasRootAccess(s)) continue;
		if (ns.getServerRequiredHackingLevel(s) > (myHacking / 2) + 2) continue;

		const maxMoney = ns.getServerMaxMoney(s);
		if (maxMoney <= 0) continue;

		const minSec = ns.getServerMinSecurityLevel(s);
		const score = maxMoney / minSec;

		if (score > bestValue) {
			bestValue = score;
			best = s;
		}
	}

	return best;
}

function scanAll(ns: NS) {
	const ret = [];
	const seen: Set<string> = new Set();
	const queue: string[] = ["home"];

	while (queue.length > 0) {
		const host = queue.shift()!;
		if (seen.has(host)) continue;

		seen.add(host);
		ret.push(host);

		for (const next of ns.scan(host)) {
			if (!seen.has(next)) {
				queue.push(next);
			}
		}
	}
	seen.clear();

	return ret;
}
