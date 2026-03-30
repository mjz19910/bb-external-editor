import { ScriptPort } from "../type/ScriptPort";

type SendMessage = {
	type: "wait";
	on: "darknet.nextMutation";
	reply_port: 4;
};

export async function main(ns: NS) {
	const args = ns.args;
	if (typeof args[0] != "string") {
		ns.tprint("missing current host as arg");
		return;
	}
	const port = new ScriptPort(ns, 1);
	const port4 = new ScriptPort(ns, 4);
	const ips = ns.dnet.probe(true);
	port.write<SendMessage>({
		type: "wait",
		on: "darknet.nextMutation",
		reply_port: 4,
	});
	await port4.nextWrite();
	ns.print(port4.read<unknown>());
	port.write({
		type: "darknet.probe",
		for: ns.args[0],
		alt: "ip",
		results: ips,
	});
}
