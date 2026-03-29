// weaken.ts
import { parseHgwRequest, HgwRequest } from "lib/hgw-message";
import { handleRequest } from "lib/handleRequest";

export async function main(ns: NS) {
	const req = parseHgwRequest(ns);
	await handleRequest(ns, req, async (data: HgwRequest) => {
		return ns.weaken(data.target, { additionalMsec: data.offset });
	});
}
