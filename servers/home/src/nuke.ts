import { AutocompleteData, NS, ScriptArg } from "../@ns";
import { isNormalServer } from "../lib/helper";
import { HostInfoDB } from "./HostInfoDB";

export async function main(ns: NS) {
	const f = ns.flags([["target", "n00dles"]]) as {
		target: string;
		_: ScriptArg[];
	};
	const target = f.target;
	const db = new HostInfoDB(ns);
	const srv = db.find(target).server;
	if (!isNormalServer(srv)) return;
	if (srv === null) return ns.tprint("missing targetSrv");
	if (srv.openPortCount === void 0) return ns.tprint("missing openPortCount");
	if (srv.numOpenPortsRequired === void 0) {
		return ns.tprint("required port count missing from cached server");
	}
	if (srv.hasAdminRights) {
		return ns.tprint("already have admin rights for " + target);
	}
	if (srv.openPortCount >= srv.numOpenPortsRequired) {
		const success = ns.nuke(target);
		if (success) {
			srv.hasAdminRights = true;
			db.save();
			ns.tprint("nuked " + target);
		} else {
			ns.tprint("nuke failed " + target);
		}
	} else {
		ns.tprint(
			"need " + srv.numOpenPortsRequired + " open ports to nuke " +
				target,
		);
	}
}
export function autocomplete(data: AutocompleteData, args: ScriptArg[]) {
	if (args.length === 0) return ["--target"];
	if (args[0] != "--target") return ["--target"];
	if (args.length === 1) return data.servers;
	if (typeof args[1] != "string") return [];
	if (data.servers.includes(args[1])) return [];
	return data.servers;
}
