// hgw-message.ts
import { ScriptArg } from "../NetscriptDefinitions.d";
import { Arg } from "./arg-codec";

export type HgwType = "hack" | "grow" | "weaken";

export interface BatchEnvelope {
	server: string;
	target: string;
	batchId: number;
}

export interface HgwRequest extends BatchEnvelope {
	type: HgwType;
	offset: number;
	replyPort: number;
	requestedAt: number;
}

export interface HgwReply extends BatchEnvelope {
	type: HgwType;
	result: number;
	completedAt: number;
}

export type HgwRequestArgs = [
	type: HgwType,
	server: string,
	target: string,
	batchId: number,
	offset: number,
	replyPort: number,
	requestedAt: number,
];

export function hgwRequestToArgs(req: HgwRequest): HgwRequestArgs {
	return [
		req.type,
		req.server,
		req.target,
		req.batchId,
		req.offset,
		req.replyPort,
		req.requestedAt,
	];
}

function parseHgwType(value: unknown): HgwType {
	if (value === "hack" || value === "grow" || value === "weaken") {
		return value;
	}
	throw new Error(`Invalid HgwRequest.type: ${String(value)}`);
}

export const HgwRequestCodec = {
	MIN_ARG_COUNT: 7 as const,

	toArgs(req: HgwRequest): HgwRequestArgs {
		return [
			req.type,
			req.server,
			req.target,
			req.batchId,
			req.offset,
			req.replyPort,
			req.requestedAt,
		];
	},

	fromArgs(args: ScriptArg[]): HgwRequest {
		if (args.length < this.MIN_ARG_COUNT) {
			throw new Error(
				`HgwRequestCodec.fromArgs expected at least ${this.MIN_ARG_COUNT} args, got ${args.length}: ${
					JSON.stringify(args)
				}`,
			);
		}

		const [type, server, target, batchId, offset, replyPort, requestedAt] =
			args;

		if (type !== "hack" && type !== "grow" && type !== "weaken") {
			throw new Error(`Invalid HgwRequest.type: ${type}`);
		}

		return {
			type: parseHgwType(type),
			server: Arg.string(server, "HgwRequest.server"),
			target: Arg.string(target, "HgwRequest.target"),
			batchId: Arg.int(batchId, "HgwRequest.batchId"),
			offset: Arg.number(offset, "HgwRequest.offset"),
			replyPort: Arg.port(replyPort, "HgwRequest.replyPort"),
			requestedAt: Arg.int(requestedAt, "HgwRequest.requestedAt"),
		};
	},
};

export function parseHgwRequest(ns: NS): HgwRequest | null {
	return HgwRequestCodec.fromArgs(ns.args);
}

export function makeHgwReply(req: HgwRequest, result: number): HgwReply {
	return {
		...req,
		result,
		completedAt: Date.now(),
	};
}

export function logHgw(req: HgwRequest, result: number) {
	const cols = [
		req.type.toUpperCase().padEnd(6),
		req.server.padEnd(10),
		req.target.padEnd(15),
		req.offset.toString().padStart(5),
		req.batchId.toString(16).padStart(5),
		result.toString().padStart(8),
	];
	return cols.join(" | ");
}
