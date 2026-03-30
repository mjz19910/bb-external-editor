import { Darknet, WithPort } from "./misc";

const dnet_files_dyn: string[] = [];
dnet_files_dyn.push("darknet/probe2.ts");
dnet_files_dyn.push("darknet/misc.ts");
dnet_files_dyn.push("darknet/types.ts");
dnet_files_dyn.push("NetscriptDefinitions.d.ts");
dnet_files_dyn.push(Darknet.MemoryReallocation);
dnet_files_dyn.push(WithPort.Read);
dnet_files_dyn.push("type/helper.ts");
dnet_files_dyn.push("type/ScriptPort.ts");

export async function main(ns: NS) {
	const f = ns.flags([["threads", 1]]) as {
		threads: number;
	};
	const local_probe = ns.dnet.probe();
	if (local_probe.length == 1 && local_probe[0] == "darkweb") {
		if (!ns.isRunning("query_server.ts")) {
			ns.run("query_server.ts", 1);
			await ns.sleep(80);
		}
		if (!ns.isRunning("port_read.ts")) {
			ns.run("port_read.ts");
			await ns.sleep(80);
		}
		ns.scp(dnet_files_dyn, "darkweb", "home");
		const pid = ns.exec(
			"darknet/probe2.ts",
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
