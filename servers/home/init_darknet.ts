import { Darknet, WithPort } from "./darknet_paths";

export function main(ns: NS) {
	const f = ns.flags([["threads", 2], ["port", 1]]) as {
		threads: number;
		port: number;
	};
	const dnet_files_dyn: string[] = [];
	dnet_files_dyn.push("darknet_probe.ts");
	dnet_files_dyn.push("darknet_paths.ts");
	dnet_files_dyn.push("darknet/misc.ts");
	dnet_files_dyn.push("NetscriptDefinitions.d.ts");
	dnet_files_dyn.push(Darknet.MemoryReallocation);
	dnet_files_dyn.push(WithPort.Read);
	const local_probe = ns.dnet.probe();
	if (local_probe.length == 1 && local_probe[0] == "darkweb") {
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
