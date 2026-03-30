import { ScriptPort } from "../type/ScriptPort";

type SendMessage = {
	type: "wait";
	on: "darknet.nextMutation";
	reply_port: 4;
};

type ReplyMessage = {
	type: "darknet.probe";
	for: string;
	alt: "ip";
	results: string[];
};

type ProbeMessageTypes = SendMessage | ReplyMessage;

export async function main(ns: NS) {
	const args = ns.args;
	if (typeof args[0] != "string") {
		ns.tprint("missing current host as arg");
		return;
	}
	ns.ui.openTail();
	const port = new ScriptPort<ProbeMessageTypes>(ns, 1);
	const port4 = new ScriptPort(ns, 4);
	port.write<SendMessage>({
		type: "wait",
		on: "darknet.nextMutation",
		reply_port: 4,
	});
	await port4.nextWrite();
	ns.print(port4.readOpt<null>());
	const ips = ns.dnet.probe(true);
	port.write<ReplyMessage>({
		type: "darknet.probe",
		for: args[0],
		alt: "ip",
		results: ips,
	});
	await Promise.race([port4.nextWrite(), ns.asleep(500)]);
	ns.print(port4.readOpt<null>());
}
