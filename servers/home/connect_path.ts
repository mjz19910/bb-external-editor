import { NS } from "./@ns";
import { buildNetworkMap, connectString, pathTo } from "./lib/network_map";

export async function main(ns: NS) {
	const target = String(ns.args[0] ?? "");
	if (!target) {
		ns.tprint("Usage: run connect_path.js <server>");
		return;
	}

	const map = buildNetworkMap(ns);

	if (!map.nodes[target]) {
		ns.tprint(`Server not found: ${target}`);
		return;
	}

	const path = pathTo(map, target);
	ns.tprint(`Path: ${path.join(" -> ")}`);
	ns.tprint(`Connect: ${connectString(map, target)}`);
}
