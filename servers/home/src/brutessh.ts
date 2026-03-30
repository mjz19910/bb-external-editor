import { AutocompleteData, ScriptArg } from "../NetscriptDefinitions.d";
import { HostInfoDB } from "./HostInfoDB";

export async function main(ns: NS) {
	const target = ns.args[0];
	if (typeof target != "string") {
		ns.tprint("target host not a string");
		return;
	}
	const db = new HostInfoDB(ns);
	const info = db.find(target);
	if (!info) {
		ns.tprint("no server found");
		return;
	}
	if (!info.server) {
		ns.tprint("no ns.getServer() result");
		return;
	}
	const { server } = info;
	if (server.sshPortOpen) {
		ns.tprint(target + " brutessh ignored");
		return;
	}
	const success = ns.brutessh(target);
	if (success) {
		server.sshPortOpen = true;
		db.save();
		ns.tprint(target + " brutessh success");
	} else {
		ns.tprint(target + " brutessh failed");
	}
}

export function autocomplete(data: AutocompleteData, _args: ScriptArg[]) {
	return data.servers;
}
