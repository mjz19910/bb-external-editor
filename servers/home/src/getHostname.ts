import { ScriptArg } from "../NetscriptDefinitions";
import { TypedNSP } from "../old/TypedNetScriptPort";

export async function main(ns: NS) {
	const f = ns.flags([["port", 3]]) as {
		port: number;
		_: ScriptArg[];
	};
	const port = new TypedNSP(ns, f.port);
	port.writePrevOpt<string>(ns.getHostname(), "getHostname");
}
