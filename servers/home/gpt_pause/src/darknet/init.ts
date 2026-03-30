import { Darknet, WithPort } from "./misc";

const dnet_files_dyn: string[] = [];
dnet_files_dyn.push("gpt_pause/src/darknet/probe2.ts");
dnet_files_dyn.push("gpt_pause/src/darknet/misc.ts");
dnet_files_dyn.push("gpt_pause/src/darknet/types.ts");
dnet_files_dyn.push("gpt_pause/src/@ns.ts");
dnet_files_dyn.push(Darknet.MemoryReallocation);
dnet_files_dyn.push(WithPort.Read);
dnet_files_dyn.push("gpt_pause/src/type/helper.ts");
dnet_files_dyn.push("gpt_pause/src/type/ScriptPort.ts");
dnet_files_dyn.push("gpt_pause/src/const/port.ts");

export async function main(ns: NS) {
	const f = ns.flags([["threads", 1]]) as {
		threads: number;
	};
	const local_probe = ns.dnet.probe();
	if (local_probe.length == 1 && local_probe[0] == "darkweb") {
		if (!ns.isRunning("gpt_pause/src/query_server.ts")) {
			ns.run("gpt_pause/src/query_server.ts", 1);
			await ns.sleep(80);
		}
		if (!ns.isRunning("gpt_pause/src/port_read.ts")) {
			ns.run("gpt_pause/src/port_read.ts");
			await ns.sleep(80);
		}
		ns.scp(dnet_files_dyn, "darkweb", "home");
		const pid = ns.exec(
			"gpt_pause/src/darknet/probe2.ts",
			"darkweb",
			f.threads,
			"--threads",
			f.threads,
			"--runner",
			"darkweb",
		);
		ns.tprint("start probe pid=", pid);
		return;
	}
}
