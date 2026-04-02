function exec_if(
	ns: NS,
	script: string,
	host: string,
	threads: number,
	...args: ScriptArg[]
) {
	if (!ns.isRunning(script, host, ...args)) {
		ns.exec(script, host, threads, ...args);
	}
}

function manager_run_once(
	ns: NS,
	reserve: number,
	buyMinRam: number,
	upgradeMinRam: number,
) {
	exec_if(ns, "root_all.ts", "home", 1);
	exec_if(ns, "buy_servers.ts", "home", 1, reserve, buyMinRam);
	exec_if(ns, "upgrade_servers.ts", "home", 1, reserve, upgradeMinRam);
}

export async function main(ns: NS) {
	const reserve = Number(ns.args[0] ?? 500_000);
	const buyMinRam = Number(ns.args[1] ?? 1);
	const upgradeMinRam = Number(ns.args[2] ?? 1);

	while (true) {
		try {
			manager_run_once(ns, reserve, buyMinRam, upgradeMinRam);
		} catch (err) {
			ns.tprint(`[MANAGE ERROR] ${String(err)}`);
		}
		await ns.sleep(60_000);
	}
}
