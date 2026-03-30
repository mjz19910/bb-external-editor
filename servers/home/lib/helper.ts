import { DarknetServer } from "../darknet/misc";
import { Server } from "../NetscriptDefinitions";

export function isNormalServer(
	s: { hostname: string } | Server | DarknetServer,
): s is Server {
	return "moneyMax" in s;
}
