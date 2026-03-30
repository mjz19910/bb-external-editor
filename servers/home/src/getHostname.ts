import { ScriptArg } from "../NetscriptDefinitions";
import { ScriptPort } from "../type/ScriptPort";

export async function main(ns: NS) {
	const f = ns.flags([["port", 3]]) as {
		port: number;
		_: ScriptArg[];
	};
	const port = new ScriptPort(ns, f.port);
	port.writePrevOpt<string>(ns.getHostname(), "getHostname");
}
