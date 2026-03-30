import { handleRequest } from "../lib/handleRequest";
import { HgwRequest, parseHgwRequest } from "../lib/hgw-message";

// hack.ts
export async function main(ns: NS) {
	const req = parseHgwRequest(ns);
	await handleRequest(ns, req, async (data: HgwRequest) => {
		return ns.hack(data.target, { additionalMsec: data.offset });
	});
}
