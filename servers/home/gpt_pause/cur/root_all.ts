import { buildNetworkMap } from "../lib/network_map";

export async function main(ns: NS) {
	const map = buildNetworkMap(ns);
	const rooted = [];
	const skipped = [];

	for (const host of map.hosts) {
		if (host === "home") continue;
		if (ns.hasRootAccess(host)) continue;

		const reqPorts = ns.getServerNumPortsRequired(host);
		const myPorts = countPortOpeners(ns);

		if (reqPorts > myPorts) {
			skipped.push(`${host} (ports ${reqPorts})`);
			continue;
		}

		tryOpenPorts(ns, host);

		try {
			ns.nuke(host);

			if (ns.hasRootAccess(host)) {
				rooted.push(host);
				ns.tprint(`[ROOTED] ${host}`);
			} else {
				skipped.push(`${host} (nuke failed)`);
			}
		} catch (err) {
			skipped.push(`${host} (error: ${String(err)})`);
		}
	}

	ns.tprint(`=== ROOT SUMMARY ===`);
	ns.tprint(`Rooted: ${rooted.length}`);
	if (rooted.length > 0) ns.tprint(rooted.join(", "));

	ns.tprint(`Skipped: ${skipped.length}`);
	if (skipped.length > 0) ns.tprint(skipped.map((v) => `{${v}}`).join("\ "));
}

function tryOpenPorts(ns: NS, host: string) {
	if (ns.fileExists("BruteSSH.exe", "home")) ns.brutessh(host);
	if (ns.fileExists("FTPCrack.exe", "home")) ns.ftpcrack(host);
	if (ns.fileExists("relaySMTP.exe", "home")) ns.relaysmtp(host);
	if (ns.fileExists("HTTPWorm.exe", "home")) ns.httpworm(host);
	if (ns.fileExists("SQLInject.exe", "home")) ns.sqlinject(host);
}

function countPortOpeners(ns: NS) {
	let count = 0;
	if (ns.fileExists("BruteSSH.exe", "home")) count++;
	if (ns.fileExists("FTPCrack.exe", "home")) count++;
	if (ns.fileExists("relaySMTP.exe", "home")) count++;
	if (ns.fileExists("HTTPWorm.exe", "home")) count++;
	if (ns.fileExists("SQLInject.exe", "home")) count++;
	return count;
}
