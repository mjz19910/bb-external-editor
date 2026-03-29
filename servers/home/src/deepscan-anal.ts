/*
	deepscan-analyze.ts for Bitburner v0.47.2
	Winners don't use copyright
    
	Latest version of this script should be at
		https://github.com/iuriguilherme/netscripts.d
	Bitburner should be at https://github.com/danielyxie/bitburner
    
	This script requires 2.95 GB of RAM to run for 1 thread(s)

	This script displays information on all scannable servers in the 
	network. All information is printed in the terminal.
	This is not equivalent to running `analyze` or `scan-analyze` on 
	every server, it only uses netscript readily available functions. 
	Some features from `analyze` may be missing, however there may be 
	other features not present on `analyze` or `scan-analyze`.
*/

function security_info(ns: NS, server: string) {
	const cur = ns.getServerSecurityLevel(server)
	const base = ns.getServerBaseSecurityLevel(server)
	const min = ns.getServerMinSecurityLevel(server)
	return `Server security level: ${cur} (${base} base, ${min} minimum)`
}

export async function main(ns: NS) {
	ns.ramOverride(3)
	const allServers: string[] = []
	const servers = []
	const whoami = ns.getHostname()
	servers.push(whoami)

	while (servers.length > 0) {
		const server = servers.pop()
		if (server === void 0) break
		if (!allServers.includes(server)) {
			allServers.push(server);
			ns.tprint("Analyzing " + server + "...");
			ns.tprint("Root Access: ", ns.hasRootAccess(server));
			ns.tprint("Required hacking skill: ", ns.getServerRequiredHackingLevel(server))
			ns.tprint("Required number of open ports for NUKE: ", ns.getServerNumPortsRequired(server));
			ns.tprint("==hack: ", ns.getHackTime(server), " seconds");
			ns.tprint("==grow: ", ns.getGrowTime(server), " seconds");
			ns.tprint("==weaken: ", ns.getWeakenTime(server), " seconds");
			const max_ram = ns.getServerMaxRam(server)
			const used_ram = ns.getServerUsedRam(server)
			ns.tprint("RAM: ", max_ram, "GB total / ", used_ram, "GB used / ", (max_ram - used_ram), "GB available");
			ns.tprint(security_info(ns, server))
			ns.tprint(
				"Estimated total money available on server: $" +
				ns.format.number(ns.getServerMoneyAvailable(server))
			);
			ns.tprint("Money growth parameter: " + ns.getServerGrowth(server));
			ns.tprint("List of files found on " + server + ": " + ns.ls(server));
			ns.tprint("Will now scan " + server + " for connected servers...");
			const nextServers = ns.scan(server);
			for (let i = 0; i < nextServers.length; ++i) {
				if (!allServers.includes(nextServers[i])) {
					ns.tprint(
						"++found " +
						nextServers[i] +
						" connected to " +
						server +
						", adding to servers list"
					);
					servers.push(nextServers[i]);
				} else {
					ns.tprint(
						"--found " +
						nextServers[i] +
						" connected to " +
						server +
						", but it's already on allServers" +
						", not adding to servers."
					);
				}
			}
		}
	}
	ns.tprint(
		"Full list of servers found in the network:" +
		allServers.join(', ')
	);
}