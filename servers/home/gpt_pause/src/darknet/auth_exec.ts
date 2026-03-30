import { NS } from "../../../@ns";
import { Darknet, WithPort } from "./misc";

const darknet_files_dyn: string[] = [];
darknet_files_dyn.push("darknet/probe2.ts");
darknet_files_dyn.push("darknet/misc.ts");
darknet_files_dyn.push("darknet/types.ts");
darknet_files_dyn.push("@ns.ts");
darknet_files_dyn.push(Darknet.MemoryReallocation);
darknet_files_dyn.push(WithPort.Read);
darknet_files_dyn.push("type/helper.ts");
darknet_files_dyn.push("type/ScriptPort.ts");

export async function main(ns: NS) {
	const [h, w] = ns.args as [string, string];
	const result = await ns.dnet.authenticate(h, w);
	switch (result.code) {
		default:
			ns.tprint("auth result unknown ", result);
			break;
	}
	if (result.success) {
		ns.scp(darknet_files_dyn, h, "home");
		ns.exec("darknet/probe2.ts", h);
	}
	ns.writePort(1, {
		type: "dnet.authenticate",
		host: h,
		password: w,
		result,
	});
}
