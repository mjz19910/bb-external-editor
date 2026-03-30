import { NS, Server } from "./@ns";
import { DarknetServer, isDarknetServer2 } from "./darknet/misc";
import { isNormalServer } from "./lib/helper";
import { HostInfoDB } from "./HostInfoDB";
import { read_string_arg } from "./arg_parse";

export async function main(ns: NS) {
	const state = new class {
		script_ram_target = -1;
		find_weaken_target = false;
		weaken_target_server: string | null = null;
	}();
	if (ns.args[0] === "--script-ram") {
		state.script_ram_target = ns.args[1] as number;
	} else if (ns.args[0] === "--next-weaken") {
		const args = ns.args.splice(0, 2);
		state.find_weaken_target = true;
		state.weaken_target_server = read_string_arg(args[1]);
	} else {
		ns.tprint("no arguments choose option");
		ns.tprint("\t--script-ram [ram]");
		ns.tprint("\t--next-weaken # find next weaken target");
		return;
	}
	const db = new HostInfoDB(ns);
	const host_map: Record<string, Server> = {};
	const dark_host_map: Record<string, DarknetServer> = {};
	for (const info of db.data) {
		const srv = info.server;
		if (isDarknetServer2(srv)) {
			dark_host_map[srv.hostname] = srv;
			continue;
		}
		host_map[srv.hostname] = srv;
	}
	for (const info of db.data) {
		const srv = info.server;
		const host = srv.hostname;
		if (state.script_ram_target !== -1) {
			if (!srv.hasAdminRights) continue;
			if (host === "home") continue;
			const free_ram = srv.maxRam - srv.ramUsed;
			if (free_ram > state.script_ram_target) {
				const threads_to_fill_ram = Math.floor(
					free_ram / state.script_ram_target,
				);
				ns.tprint(
					"threads ",
					threads_to_fill_ram,
					" to fill ram of " + host,
				);
			}
		}
		if (state.find_weaken_target && state.weaken_target_server) {
			if (!srv.backdoorInstalled) continue;
			if (!isNormalServer(srv)) continue;
			if (srv.hackDifficulty != srv.minDifficulty) {
				const exec_server = host_map[state.weaken_target_server];
				const free_ram = exec_server.maxRam;
				ns.tprint(
					"weaken " + host + " by ",
					srv.hackDifficulty! - srv.minDifficulty!,
					" ",
					Math.floor(ns.getHackTime(host) / 1000),
				);
				// (script: string, hostname: string, threadOrOptions?: number | RunOptions | undefined, ...args: ScriptArg[])
				ns.tprint(
					`run api/exec.ts api/loop/weaken.ts ${
						Math.floor(free_ram / 1.15)
					} ${host} -r ${state.weaken_target_server}`,
				);
			}
		}
	}
}
