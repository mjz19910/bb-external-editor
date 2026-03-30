import { buildNetworkMap, runnableHosts } from "./lib/network_map";
import { tlog } from "./lib/log";
import { NS } from "./@ns";

const FILES = [
	"hack_worker.js",
	"grow_worker.js",
	"weaken_worker.js",
];

export async function main(ns: NS) {
	const map = buildNetworkMap(ns);
	const runners = runnableHosts(ns, map.hosts);

	let copied = 0;

	for (const host of runners) {
		if (host === "home") continue;
		ns.scp(FILES, host, "home");
		copied++;
		tlog(ns, `[DEPLOY] ${host}`);
	}

	tlog(ns, `Deployed to ${copied} servers.`);
}
