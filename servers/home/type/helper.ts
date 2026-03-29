import { DarknetServerInfo } from "../darknet/types";
import { DarknetResult } from "../NetscriptDefinitions.d";

export type WaitMessage = {
	type: "wait";
	on: "darknet.nextMutation";
	reply_port: number;
};
export type DarknetAuthenticateMessage = {
	type: "darknet.authenticate";
	by: string;
	for: string;
	auth: DarknetResult;
	password: string;
};
export type QuitMessage = { type: "quit" };
export type DarkNetProbeMessage = {
	type: "darknet.probe";
	by: string;
	infos: DarknetServerInfo[];
};
export type DarknetFoundPassProbeMessage = {
	type: "found_password";
	by: string;
	for: string;
	password: string;
};
export type NewWordsMessage = {
	type: "new_words";
	from_dict: "commonPasswordDictionary";
	list: string[];
};
