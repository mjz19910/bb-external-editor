/** unlock_all.ts */

export async function main(ns: NS) {
	const visited = new Set<string>()
	const queue: string[] = ["home"]

	// Detect available cracking programs
	const crackers: { file: string; fn: (host: string) => void }[] = [
		{ file: "BruteSSH.exe", fn: ns.brutessh },
		{ file: "FTPCrack.exe", fn: ns.ftpcrack },
		{ file: "relaySMTP.exe", fn: ns.relaysmtp },
		{ file: "HTTPWorm.exe", fn: ns.httpworm },
		{ file: "SQLInject.exe", fn: ns.sqlinject },
	]

	const available = crackers.filter(c => ns.fileExists(c.file, "home"))

	ns.tprint(`Available crackers: ${available.map(c => c.file).join(", ") || "none"}`)

	while (queue.length > 0) {
		const host = queue.shift()!
		if (visited.has(host)) continue
		visited.add(host)

		// Scan neighbors
		const neighbors = ns.scan(host)
		for (const n of neighbors) {
			if (!visited.has(n)) queue.push(n)
		}

		if (host === "home") continue

		try {
			// Open ports
			for (const c of available) {
				try {
					c.fn(host)
				} catch { }
			}

			const required = ns.getServerNumPortsRequired(host)
			const opened = available.length

			if (opened >= required) {
				ns.nuke(host)
				ns.tprint(`NUKED ${host}`)
			}
		} catch (e) {
			ns.tprint(`Error on ${host}: ${e}`)
		}

		await ns.sleep(10)
	}

	ns.tprint("Done unlocking all reachable servers.")
}