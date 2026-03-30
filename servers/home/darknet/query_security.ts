import { ScriptPort } from "../type/ScriptPort";

export async function main(ns: NS) {
	const port2 = new ScriptPort(ns, 2);
	const res = port2.readOpt<string>();
	if (res.type === "None") {
		return ns.tprint("port(2): nothing to query");
	}
	const { value: query_str } = res;
	const [query_cmd, query_arg] = query_str.split(" ");
	ns.tprint("query ", query_cmd, " ", query_arg.split(","));
}
