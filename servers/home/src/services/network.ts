export function tryRootAll(ns: NS, hosts: string[]): string[] {
	const rooted: string[] = []

	for (const host of hosts) {
		if (host === "home") continue

		if (ns.hasRootAccess(host)) {
			rooted.push(host)
			continue
		}

		tryOpenPorts(ns, host)

		const requiredPorts = ns.getServerNumPortsRequired(host)

		if (getAvailablePortOpeners(ns) >= requiredPorts) {
			try {
				ns.nuke(host)
			} catch {
				// ignore
			}
		}

		if (ns.hasRootAccess(host)) {
			rooted.push(host)
		}
	}

	return rooted
}

function tryOpenPorts(ns: NS, host: string): void {
	try {
		if (ns.fileExists("BruteSSH.exe", "home")) ns.brutessh(host)
	} catch { }

	try {
		if (ns.fileExists("FTPCrack.exe", "home")) ns.ftpcrack(host)
	} catch { }

	try {
		if (ns.fileExists("relaySMTP.exe", "home")) ns.relaysmtp(host)
	} catch { }

	try {
		if (ns.fileExists("HTTPWorm.exe", "home")) ns.httpworm(host)
	} catch { }

	try {
		if (ns.fileExists("SQLInject.exe", "home")) ns.sqlinject(host)
	} catch { }
}

function getAvailablePortOpeners(ns: NS): number {
	let count = 0

	if (ns.fileExists("BruteSSH.exe", "home")) count++
	if (ns.fileExists("FTPCrack.exe", "home")) count++
	if (ns.fileExists("relaySMTP.exe", "home")) count++
	if (ns.fileExists("HTTPWorm.exe", "home")) count++
	if (ns.fileExists("SQLInject.exe", "home")) count++

	return count
}
