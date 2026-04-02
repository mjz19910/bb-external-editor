import { buildNetworkMap } from "../../servers/home/lib/network_map";

export async function main(ns: NS) {
	ns.disableLog("ALL");
	ns.clearLog();

	const reserve = ns.args.includes("--reserve")
		? Number(ns.args[ns.args.indexOf("--reserve") + 1] ?? 0)
		: 0;

	const script = "gpt_pause/src/hack.ts";
	const scriptRam = ns.getScriptRam(script);
	const map = buildNetworkMap(ns);

	const hosts = map.allHosts.filter((h) =>
		ns.hasRootAccess(h) &&
		map.ramSizes[h] > 0
	);

	while (true) {
		const targets = map.allHosts.filter((s) =>
			s !== "home" &&
			ns.hasRootAccess(s) &&
			ns.getServerMaxMoney(s) > 0 &&
			ns.getServerRequiredHackingLevel(s) <= ns.getHackingLevel()
		);

		const scored = targets
			.map((target) => ({
				target,
				score: scoreTarget(ns, target),
				money: ns.getServerMoneyAvailable(target),
				time: ns.getHackTime(target),
			}))
			.filter((x) => x.score > 0 && x.money > 1)
			.sort((a, b) => b.score - a.score);

		if (scored.length === 0) {
			ns.print("No viable targets.");
			await ns.sleep(5000);
			continue;
		}

		const best = scored[0];
		let launched = 0;

		for (const host of hosts) {
			const maxRam = map.ramSizes[host];
			const usedRam = ns.getServerUsedRam(host);
			const freeRam = host === "home"
				? Math.max(0, maxRam - usedRam - reserve)
				: Math.max(0, maxRam - usedRam);

			const mav = ns.getServerMoneyAvailable(best.target);
			if (mav < 1) {
				break;
			}

			const threads = Math.floor(freeRam / scriptRam);
			if (threads <= 0) continue;

			if (!ns.fileExists(script, host)) {
				ns.scp(script, host);
			}

			const pid = ns.exec(script, host, threads, best.target, threads);
			if (pid !== 0) launched += threads;
		}

		if (launched > 0) {
			ns.print(`Best target: ${best.target}`);
			ns.print(`Money: ${formatMoney(ns, best.money)}`);
			ns.print(`Hack time: ${(best.time / 1000).toFixed(2)}s`);
			ns.print(`Score: ${best.score.toFixed(2)}`);
			ns.print(`Launched threads: ${launched}`);
		}

		// Wait a bit before re-evaluating
		await ns.sleep(5000);
	}
}

function scoreTarget(ns: NS, target: string) {
	const money = ns.getServerMoneyAvailable(target);
	if (money <= 0) return 0;

	const chance = ns.hackAnalyzeChance(target);
	const percent = ns.hackAnalyze(target);
	const time = ns.getHackTime(target);

	return (money * percent * chance) / time;
}

function formatMoney(ns: NS, n: number) {
	return "$" + ns.format.number(n, 2);
}
