const script_paths = {
	hack: "src/hack2.ts",
	grow: "src/grow2.ts",
	weaken: "tmp/weak.ts",
} as const;
const alt_script_paths = {
	hack: "_/hack.ts",
	grow: "_/grow.ts",
	weaken: "_/weak.ts",
} as const;
type Get<T> = T[keyof T];
type C<T, U> = (Get<T> | Get<U>) & {};
type AnyScriptPath = C<typeof script_paths, typeof alt_script_paths>;
export async function main(ns: NS) {
	ns.disableLog("ALL");
	ns.clearLog();

	const host = ns.getHostname();
	let target_paths = null;

	if (ns.fileExists("_/hack.ts", host)) {
		target_paths = alt_script_paths;
	} else {
		target_paths = script_paths;
	}

	const hackScript = target_paths.hack;
	const growScript = target_paths.grow;
	const weakenScript = target_paths.weaken;
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

		const freeRam = ns.getServerMaxRam(host) - ns.getServerUsedRam(host);

		let script: AnyScriptPath = weakenScript;
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
