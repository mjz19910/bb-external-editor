import { Darknet, WithPort } from "./misc";

const darknet_files_dyn: string[] = [];
darknet_files_dyn.push("gpt_pause/src/darknet/probe2.ts");
darknet_files_dyn.push("gpt_pause/src/darknet/misc.ts");
darknet_files_dyn.push("gpt_pause/src/darknet/types.ts");
darknet_files_dyn.push(Darknet.MemoryReallocation);
darknet_files_dyn.push(WithPort.Read);
darknet_files_dyn.push("gpt_pause/src/type/helper.ts");
darknet_files_dyn.push("gpt_pause/src/type/ScriptPort.ts");

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
		ns.exec("gpt_pause/src/darknet/probe2.ts", h);
	}
	ns.writePort(1, {
		type: "dnet.authenticate",
		host: h,
		password: w,
		result,
	});
}
