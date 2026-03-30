// grow.ts
import { HgwRequest, parseHgwRequest } from "../gpt_pause/lib/hgw-message";
import { handleRequest } from "../gpt_pause/lib/handleRequest";
import { NS } from "../@ns";

export async function main(ns: NS) {
	const req = parseHgwRequest(ns);
	await handleRequest(ns, req, async (data: HgwRequest) => {
		return ns.grow(data.target, { additionalMsec: data.offset });
	});
}
