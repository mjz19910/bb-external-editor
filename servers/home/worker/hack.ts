// hack.ts
import { HgwRequest, parseHgwRequest } from "../lib/hgw-message";
import { handleRequest } from "../lib/handleRequest";
import { NS } from "../@ns";

export async function main(ns: NS) {
	const req = parseHgwRequest(ns);
	await handleRequest(ns, req, async (data: HgwRequest) => {
		return ns.hack(data.target, { additionalMsec: data.offset });
	});
}
