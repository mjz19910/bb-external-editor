import { buildNetworkMap, runnableHosts } from "../src/lib/network_map";
import { tlog } from "../src/lib/log";
import { NS } from "./@ns";

const FILES = [
	"gpt_pause/src/hack_worker.ts",
	"gpt_pause/src/grow_worker.ts",
	"gpt_pause/src/weaken_worker.ts",
];

export async function main(ns: NS) {
	const map = buildNetworkMap(ns);
	const runners = runnableHosts(ns, map, map.hosts);

	let copied = 0;

	for (const host of runners) {
		if (host === "home") continue;
		ns.scp(FILES, host, "home");
		copied++;
		tlog(ns, `[DEPLOY] ${host}`);
	}

	tlog(ns, `Deployed to ${copied} servers.`);
}
