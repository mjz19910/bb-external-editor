import { NS } from "../@ns";
import { buildNetworkMap } from "../lib/network_map";

export async function main(ns: NS) {
	ns.disableLog("ALL");
	ns.clearLog();

	const host = ns.getHostname();
	const hackScript = "_/hack.ts";
	const growScript = "_/grow.ts";
	const weakenScript = "_/weak.ts";
	let time_offset = 1.5;
	let did_launch = false;
	let cur_pid = -1;

	ns.atExit(() => {
		ns.kill(cur_pid);
	});

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

		let freeRam = ns.getServerMaxRam(host) - ns.getServerUsedRam(host);
		if (host === "home") {
			freeRam -= 32;
		}

		let script = weakenScript;
		let threads = 1;
		let wait_ms = 500;

		if (sec > minSec + 5) {
			script = weakenScript;
			threads = Math.floor(freeRam / ns.getScriptRam(weakenScript));
			wait_ms = ns.getWeakenTime(target) + time_offset;
		} else if (money < maxMoney * 0.75) {
			script = growScript;
			threads = Math.floor(freeRam / ns.getScriptRam(growScript));
			wait_ms = ns.getGrowTime(target) + time_offset;
		} else {
			script = hackScript;
			threads = Math.floor(freeRam / ns.getScriptRam(hackScript));
			wait_ms = ns.getHackTime(target) + time_offset;
		}

		if (threads < 1) {
			if (did_launch) time_offset += 0.5;
			ns.print(
				`Not enough RAM to run ${script}; increase time offset to ${time_offset}`,
			);
			await ns.sleep(5000);
			continue;
		}

		ns.print(`Target=${target} | Script=${script} | Threads=${threads}`);
		const pid = ns.exec(script, host, threads, target);
		if (pid) {
			cur_pid = pid;
		}
		did_launch = true;

		await ns.sleep(wait_ms);
	}
}

function findBestTarget(ns: NS) {
	const myHacking = ns.getHackingLevel();
	const map = buildNetworkMap(ns);

	let best = null;
	let bestValue = 0;

	for (const s of map.hosts) {
		if (s === "home") continue;
		if (!ns.hasRootAccess(s)) continue;
		if (ns.getServerRequiredHackingLevel(s) > (myHacking / 2) + 2) continue;

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
