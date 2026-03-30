import { Darknet, WithPort } from "./darknet_paths";

const dnet_files_dyn: string[] = [];
dnet_files_dyn.push("darknet_probe.ts");
dnet_files_dyn.push("darknet_paths.ts");
dnet_files_dyn.push("darknet/misc.ts");
dnet_files_dyn.push("darknet/types.ts");
dnet_files_dyn.push("NetscriptDefinitions.d.ts");
dnet_files_dyn.push(Darknet.MemoryReallocation);
dnet_files_dyn.push(WithPort.Read);
dnet_files_dyn.push("type/helper.ts");
dnet_files_dyn.push("type/ScriptPort.ts");

export async function main(ns: NS) {
	const f = ns.flags([["threads", 1], ["port", 1]]) as {
		threads: number;
		port: number;
	};
	const local_probe = ns.dnet.probe();
	if (local_probe.length == 1 && local_probe[0] == "darkweb") {
		if (!ns.isRunning("port_read.ts")) {
			ns.run("port_read.ts");
			await ns.sleep(300);
		}
		ns.scp(dnet_files_dyn, "darkweb", "home");
		const pid = ns.exec(
			"darknet_probe.ts",
			"darkweb",
			f.threads,
			"--port",
			f.port,
			"--threads",
			f.threads,
			"--runner",
			"darkweb",
		);
		ns.tprint("start probe pid=", pid);
		return;
	}
}
