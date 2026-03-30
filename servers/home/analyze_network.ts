import { NS } from "./@ns";
import {
	buildNetworkMap,
	classifyServer,
	hubHosts,
	leafHosts,
} from "./lib/network_map";

export async function main(ns: NS) {
	const map = buildNetworkMap(ns);

	ns.tprint(`Servers found: ${map.hosts.length}`);
	ns.tprint("");

	for (const host of map.hosts) {
		const node = map.nodes[host];
		const cls = classifyServer(ns, host);
		const reqHack = ns.getServerRequiredHackingLevel(host);
		const reqPorts = ns.getServerNumPortsRequired(host);
		const rooted = ns.hasRootAccess(host) ? "ROOT" : "NO-ROOT";
		const money = ns.getServerMaxMoney(host);

		ns.tprint(
			`${host.padEnd(20)} ` +
				`depth=${String(node.depth).padStart(2)} ` +
				`deg=${String(node.neighbors.length).padStart(2)} ` +
				`hack=${String(reqHack).padStart(4)} ` +
				`ports=${reqPorts} ` +
				`${rooted.padEnd(7)} ` +
				`${cls.padEnd(8)} ` +
				`money=${ns.format.number(money)}`,
		);
	}

	ns.tprint("");
	ns.tprint("=== TOP HUBS ===");
	for (const h of hubHosts(map).slice(0, 10)) {
		ns.tprint(`${h.host}: degree=${h.degree}`);
	}

	ns.tprint("");
	ns.tprint("=== LEAVES ===");
	for (const h of leafHosts(map)) {
		ns.tprint(h);
	}
}
