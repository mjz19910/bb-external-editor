import { buildNetworkMap } from "../../servers/home/src2/network_map";

export async function main(ns: NS) {
	const map = buildNetworkMap(ns);
	const host = ns.getHostname();
	const max_threads = Math.floor(map.ramSizes[host] / 4);
	ns.tprintRaw(`run api/loop/share.ts -t ${max_threads}`);
}
