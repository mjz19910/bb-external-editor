// grow.ts
import { parseHgwRequest, HgwRequest } from "lib/hgw-message";
import { handleRequest } from "lib/handleRequest";

export async function main(ns: NS) {
	let t = true; if (t) return;
	const req = parseHgwRequest(ns);
	await handleRequest(ns, req, async (data: HgwRequest) => {
		return ns.grow(data.target, { additionalMsec: data.offset });
	});
}
