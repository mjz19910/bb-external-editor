import { NS } from "./@ns";
import { buildNetworkMap } from "./lib/network_map";

export async function main(ns: NS) {
	ns.disableLog("ALL");
	ns.clearLog();

	const host = ns.getHostname();
	const hackScript = "_/hack.ts";
	const growScript = "_/grow.ts";
	const weakenScript = "_/weak.ts";
	const hackRam = ns.getScriptRam(hackScript);
	const growRam = ns.getScriptRam(growScript);
	const weakenRam = ns.getScriptRam(weakenScript);
	let time_offset = 1.5;
	let did_launch = false;
	let cur_pid = -1;

	ns.atExit(() => {
		ns.kill(cur_pid);
	});

	const map = buildNetworkMap(ns);

	while (true) {
		const target = map.findBestTarget(ns);
		if (!target) {
			ns.print("No valid target found.");
			await ns.sleep(5000);
			continue;
		}

		const money = ns.getServerMoneyAvailable(target);
		const maxMoney = ns.getServerMaxMoney(target);
		const sec = ns.getServerSecurityLevel(target);
		const minSec = ns.getServerMinSecurityLevel(target);

		let freeRam = map.ramSizes[host] - ns.getServerUsedRam(host);
		if (host === "home") {
			freeRam -= 32;
		}

		let script = weakenScript;
		let threads = 1;
		let wait_ms = 500;

		if (sec > minSec + 5) {
			script = weakenScript;
			threads = Math.floor(freeRam / weakenRam);
			wait_ms = ns.getWeakenTime(target) + time_offset;
		} else if (money < maxMoney * 0.75) {
			script = growScript;
			threads = Math.floor(freeRam / growRam);
			wait_ms = ns.getGrowTime(target) + time_offset;
		} else {
			script = hackScript;
			threads = Math.floor(freeRam / hackRam);
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
