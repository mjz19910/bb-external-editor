function show_scan(ns: NS, target: string) {
	const home_res = ns.scan(target);
	for (const item of home_res) {
		ns.tprint(target + " -> " + item);
	}
}
export async function main(ns: NS) {
	show_scan(ns, ns.getHostname());
}