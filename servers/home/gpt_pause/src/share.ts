import { NS } from "./@ns";

export async function main(ns: NS) {
	ns.tprint("started share");
	await ns.share();
	ns.tprint("stopped share");
}
