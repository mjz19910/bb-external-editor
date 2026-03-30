import { buildNetworkMap } from "../../lib/network_map";

export async function main(ns: NS) {
	const host = ns.getHostname();
	const map = buildNetworkMap(ns);
	const max_threads = Math.floor(map.ramSizes[host] / 4);
	ns.tprintRaw(`run api/loop/share.ts -t ${max_threads}`);
}
