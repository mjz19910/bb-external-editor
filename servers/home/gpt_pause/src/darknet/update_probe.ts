import { NS } from "../@ns";

export async function main(ns: NS) {
	let runner = ns.getHostname();
	if (runner === "home") runner = "darkweb";
	ns.scp(
		[
			"gpt_pause/src/darknet/probe2.ts",
			"gpt_pause/src/darknet/stasis.ts",
			"gpt_pause/src/darknet/update_probe.ts",
		],
		runner,
		"home",
	);
	ns.tprint("scp darknet files to ", runner);
}
