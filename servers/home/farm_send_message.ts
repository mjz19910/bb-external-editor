import { ScriptPort } from "./ScriptPort"

export function main(ns: NS) {
	const port = new ScriptPort<{ msg: true }>(ns, 1)
	port.write({ msg: true })
}
