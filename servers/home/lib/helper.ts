import { Server } from "../NetscriptDefinitions.d";
import { DarknetServer } from "../type/helper";

export function isNormalServer(s: { hostname: string } | Server | DarknetServer): s is Server {
	return "moneyMax" in s
}
