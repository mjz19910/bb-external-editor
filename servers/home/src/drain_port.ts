import { ScriptArg } from "../NetscriptDefinitions.d";
import { TypedNSP } from "../old/TypedNetScriptPort";

export async function main(ns: NS) {
	ns.ui.openTail();
	const f = ns.flags([["port", 1]]) as {
		port: number;
		_: ScriptArg[];
	};
	const port = new TypedNSP(ns, f.port);
	port.config({ logging: false });
	for (;;) {
		const res = port.readOpt("all");
		if (res.type === "None") break;
		ns.print("port ", f.port, " data ", res.value);
	}
}
