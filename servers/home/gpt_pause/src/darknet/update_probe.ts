import { NS } from "../@ns";

export async function main(ns: NS) {
	let runner = ns.getHostname();
	if (runner === "home") runner = "darkweb";
	ns.scp(
		[
			"darknet/probe.ts",
			"darknet/stasis.ts",
			"darknet/update_probe.ts",
		],
		runner,
		"home",
	);
	ns.tprint("scp darknet files to ", runner);
}
