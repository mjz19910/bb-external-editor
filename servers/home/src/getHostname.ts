import { TypedNetScriptPort } from "types/TypedNetScriptPort"

export async function main(ns: NS) {
	const f = ns.flags([["port", 3]]) as {
		port: number;
		_: ScriptArg[];
	}
	const port = new TypedNetScriptPort(ns, f.port)
	port.writeWithPrevAsMonad2<string, null>(ns.getHostname(), "getHostname")
}