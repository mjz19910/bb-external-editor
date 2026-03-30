// handleRequest.ts
import { Com } from "./port";
import { HgwRequest, makeHgwReply, logHgw, HgwReply } from "./hgw-message";
import { NS } from "../@ns";

export type RunTaskCallback = (data: HgwRequest) => Promise<number> | number;

export async function handleRequest(ns: NS, req: HgwRequest | null, runTask: RunTaskCallback) {
	if (!req) return;

	const result = await runTask(req);
	const com = new Com<HgwReply>(ns, req.replyPort);
	com.write(makeHgwReply(req, result));
	ns.print(logHgw(req, result));
}
