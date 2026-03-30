import { Darknet, isDarknetServer2, WithPort } from "./misc";
import { DarknetServerInfo } from "./types";
import {
	DarknetAuthenticateMessage,
	DarknetFoundPassProbeMessage,
	DarknetProbeMessage,
} from "../type/helper";

const ROMAN_NUMERAL_VALUES: Record<string, number> = {
	M: 1000,
	D: 500,
	C: 100,
	L: 50,
	X: 10,
	V: 5,
	I: 1,
};

function decode_roman_num(val: string): number {
	if (val.length === 0) return 0;
	if (val.length === 1) {
		const v = ROMAN_NUMERAL_VALUES[val[0]];
		if (v !== undefined) return v;
		throw new Error(`Unable to decode Roman numeral (len=1) "${val}"`);
	}

	// Look at first two letters to handle subtraction cases
	const first = ROMAN_NUMERAL_VALUES[val[0]];
	const second = ROMAN_NUMERAL_VALUES[val[1]];
	if (first === undefined || second === undefined) {
		throw new Error(`Unknown Roman numeral char: "${val}"`);
	}

	if (first < second) {
		// Subtractive notation, e.g., IV = 4
		return second - first + decode_roman_num(val.slice(2));
	} else {
		// Regular additive notation
		return first + decode_roman_num(val.slice(1));
	}
}
/**
 * Simple recursive permutation generator
 */
function permute<T>(arr: T[]): T[][] {
	if (arr.length <= 1) return [arr];
	const result: T[][] = [];

	for (let i = 0; i < arr.length; i++) {
		const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
		for (const p of permute(rest)) {
			result.push([arr[i], ...p]);
		}
	}

	return result;
}
type AuthFlowState = {
	runner: string;
	host: string;
	port: number;
	info: DarknetServerInfo;
};
const logging = false;
const ac_mgr_regexp = /The password is a number between (\d+) and (\d+)/;
export const dog_names = [
	"fido",
	"spot",
	"rover",
	"max",
];
interface FactorsBleedResult extends DarknetResult {
	code: DarknetResult["code"] & {};
	message: string;
	data: `${boolean}`;
	passwordAttempted: string;
}
const verbose = false;
type SubmitAuthArgs = [
	opts: AuthFlowState,
	auth: DarknetResult,
	password: string,
];
class AuthManager {
	constructor(public ns: NS) {}
	extract_info(opts: AuthFlowState) {
		const { info } = opts;
		const { server: srv } = info;
		const { hostname: host } = srv;
		return { opts, srv, host, authDetails: info.authDetails };
	}
	submit_auth_result(...args: SubmitAuthArgs) {
		const [opts, auth, password] = args;
		const { info, port, runner } = opts;
		const { server: srv } = info;
		const { hostname: host } = srv;
		const ns = this.ns;
		if (!auth.success) {
			if (logging) {
				ns.tprint(
					"auth failed for ",
					JSON.stringify(host),
					" code=",
					auth.code,
					" ",
					JSON.stringify(auth.message),
				);
			}
			return auth.success;
		}
		if (info.password !== password && verbose) {
			ns.tprint(
				`Authentication succeeded for ${host} password="`,
				password,
				'"',
			);
		}
		info.password = password;
		ns.writePort(port, {
			type: "darknet.authenticate",
			by: runner,
			for: host,
			auth,
			password,
		} as DarknetAuthenticateMessage);
		return auth.success;
	}
	async doAuth(opts: AuthFlowState, password: string) {
		const { host } = opts;
		const auth: DarknetResult = await this.ns.dnet.authenticate(
			host,
			password,
		);
		this.submit_auth_result(opts, auth, password);
	}
	async OctantVoxel(opts: AuthFlowState) {
		const data = opts.info.authDetails.data;
		const [base, num] = data.split(",");
		await this.doAuth(opts, "" + Number.parseInt(num, +base));
	}
	// cspell:words Factori_0s Factori-0s Factorios
	/** Solve a Factori-0s Darknet auth flow, using both valid factor sieve and invalid factor filtering */
	async Factori_0s(opts: AuthFlowState) {
		const ns = this.ns;
		const tried_num_flag = [];
		const factors: number[] = []; // confirmed valid factors >= 100
		const invalidFactors: number[] = []; // numbers ruled out by data === "false"
		const { info } = opts;
		const { server: srv } = info;
		const { hostname: host } = srv;

		ns.tprint(`Starting Factorios auth flow for ${host}`);
		const pw_len = info.authDetails.passwordLength;
		let cur_num = 1;

		for (;;) {
			let next_factor = null;
			outer: for (let i = 1; i < 999; i++) {
				for (const f of factors) {
					if (i % f != 0) continue outer;
				}
				for (const f of invalidFactors) {
					if (i % f == 0) continue outer;
				}
				if (pw_len == 2 && i >= 100) break;
				if (pw_len == 3 && i >= 1000) break;
				if (cur_num == i) continue;
				next_factor = i;
				break;
			}
			cur_num = next_factor ?? 2;
			while (tried_num_flag[cur_num]) {
				cur_num++;
			}
			tried_num_flag[cur_num] = true;
			const pw = cur_num.toString();
			ns.tprint(`authenticate(Factorios) for ${host} with "${pw}"`);
			const auth = await ns.dnet.authenticate(host, pw);
			ns.tprint("Factorios auth result:", auth);
			if (this.submit_auth_result(opts, auth, pw)) break;
			ns.tprint(`heartbleed(Factorios) for ${host}`);
			const bleed_res = await ns.dnet.heartbleed(host);
			if (!bleed_res.success) {
				ns.tprint("heartbleed failed:", bleed_res);
				break;
			}
			for (const log of bleed_res.logs) {
				let data: FactorsBleedResult | null = null;
				try {
					data = JSON.parse(log) as FactorsBleedResult;
				} catch {
					ns.tprint("heartbleed text_log ", log);
				}
				if (!data) continue;
				if (data.code != 401) {
					throw new Error(
						"Invalid heartbleed(Factors) result code=" + data.code,
					);
				}
				ns.tprint(
					`Factorios bleed status:`,
					data,
					`pw=${data.passwordAttempted} num=${cur_num}`,
				);
				let candidate = cur_num;
				const { data: feedback_raw } = data;
				const feedback = feedback_raw === "true";
				if (feedback) {
					if (!factors.includes(candidate)) {
						factors.push(candidate);
						ns.tprint(`New valid factor discovered: ${candidate}`);
					}
				} else {
					for (const f of factors) {
						if (candidate % f == 0) candidate /= f;
					}
					invalidFactors.push(candidate);
					ns.tprint(
						`Number ruled out as factor: ${candidate}, from ${cur_num}`,
					);
				}
			}
		}
	}
	// hint="The password is shuffled 359"
	async Php(opts: AuthFlowState) {
		const ns = this.ns;
		const { info } = opts;
		const ad = info.authDetails;
		const { server: srv } = info;
		const { hostname: host } = srv;
		if (!ad) return ns.tprint("No authDetails for ", host);
		const digits: string[] = ad.data.split("");
		ns.tprint("Trying all permutations of digits: ", digits.join(","));
		const calc_results: string[] = permute(digits).map((arr) =>
			arr.join("")
		);
		ns.tprint(`Generated ${calc_results.length} candidate passwords`);
		for (const pw of calc_results) {
			ns.tprint(`authenticate(PHP) for ${host} with "${pw}"`);
			const auth: DarknetResult = await ns.dnet.authenticate(
				host,
				pw,
			);
			if (this.submit_auth_result(opts, auth, pw)) break;
		}
	}
	async FreshInstall(opts: AuthFlowState) {
		const ns = this.ns;
		const { host, authDetails } = this.extract_info(opts);
		if (!authDetails) return;
		const {
			passwordFormat: format,
			passwordLength: pw_length,
			passwordHint: _hint,
		} = authDetails;
		const valid_passwords = {
			"0000": "numeric" as const,
			"12345": "numeric" as const,
			"admin": "alphabetic" as const,
			"password": "alphabetic" as const,
		};
		const pw_tries = [];
		for (const pw in valid_passwords) {
			if (valid_passwords[pw as keyof typeof valid_passwords] == format) {
				pw_tries.push(pw);
			}
		}
		for (const pw_attempt of pw_tries) {
			if (pw_length != pw_attempt.length) continue;
			const auth = await ns.dnet.authenticate(host, pw_attempt);
			if (this.submit_auth_result(opts, auth, pw_attempt)) break;
		}
	}
	async DeepGreen(opts: AuthFlowState) {
		const ns = this.ns;
		const { info } = opts;
		const { server: srv } = info;
		type DeepGreenBleedData = {
			code: 401;
			message: string;
			passwordAttempted: string;
		};
		const { authDetails: ad } = info;
		if (!ad) return;
		const { passwordLength: len } = ad;
		const { hostname: host } = srv;
		const chars = "0123456789".split("");
		const pw_arr = Array.from<string | null>({ length: len }).fill(
			null,
		);
		let sym_match_chars = [];
		for (const char of chars) {
			const pw = pw_arr.map((v) => v === null ? char : v).join("");
			const auth = await ns.dnet.authenticate(host, pw);
			if (this.submit_auth_result(opts, auth, pw)) break;
			const bleed_res = await ns.dnet.heartbleed(host);
			if (!bleed_res.success) {
				ns.tprint("heartbleed failed:", bleed_res);
				break;
			}
			for (const log of bleed_res.logs) {
				let data: DeepGreenBleedData | null = null;
				try {
					data = JSON.parse(log) as DeepGreenBleedData;
				} catch {
					ns.tprint("heartbleed text_log ", log);
				}
				if (!data) continue;
				if (data.code != 401) {
					throw new Error("Invalid bleed result code=" + data.code);
				}
				const bleed_sym_matches = data.message.match(/(\d+).+(\d+)/);
				ns.tprint("heartbleed log ", data.message);
				if (bleed_sym_matches) {
					const [, m1, m2] = bleed_sym_matches;
					const num_match = +m1;
					ns.tprint(
						"sym that match ",
						+m1,
						" sym in wrong place ",
						+m2,
					);
					if (num_match > 0) {
						const chars = char.repeat(num_match).split("");
						sym_match_chars.push(...chars);
					}
				}
			}
		}
		for (const pw_chars of permute(sym_match_chars)) {
			const pw = pw_chars.join("");
			const auth = await ns.dnet.authenticate(host, pw);
			if (this.submit_auth_result(opts, auth, pw)) break;
		}
	}
	async CloudBlare(opts: AuthFlowState) {
		const { info } = opts;
		const authDetails = info.authDetails;
		if (!authDetails) return;
		const { data } = authDetails;
		let pw = "";
		for (const dig of data.matchAll(/\d+/g)) {
			pw += dig;
		}
		await this.doAuth(opts, pw);
	}
	async DeskMemo(opts: AuthFlowState) {
		const pw = opts.info.authDetails!.passwordHint.match(/\d+/)![0];
		await this.doAuth(opts, pw);
	}
	// "The password is a number between 0 and 10"
	async AccountsManager(opts: AuthFlowState) {
		const ns = this.ns;
		type AccMgrBleedData = {
			code: 401;
			message: string;
			passwordAttempted: string;
			data: boolean;
		} | {
			code: 200;
		};
		const { host, authDetails } = this.extract_info(opts);
		const ad = authDetails;
		let match = ad.passwordHint.match(ac_mgr_regexp);
		if (!match) {
			throw new Error(
				"Invalid AccountsManager hint " + ad.passwordHint,
			);
		}
		const [, min_arg, max_arg] = match as [string, string, string];
		const min = +min_arg, max = +max_arg;
		for (let i = min; i < max; i++) {
			const pw = "" + i;
			const auth = await ns.dnet.authenticate(host, pw);
			if (this.submit_auth_result(opts, auth, pw)) break;
			const bleed_res = await ns.dnet.heartbleed(host);
			if (!bleed_res.success) {
				ns.tprint("heartbleed failed:", bleed_res);
				break;
			}
			for (const log of bleed_res.logs) {
				let data: AccMgrBleedData | null = null;
				try {
					data = JSON.parse(log) as AccMgrBleedData;
				} catch {
					ns.tprint("heartbleed text_log ", log);
				}
				if (!data) continue;
				if (data.code === 200) {
					ns.tprint("heartbleed(AccMgr,200) log ", data);
					continue;
				}
				if (data.code != 401) {
					const err_code = (data as { code: number }).code;
					throw new Error(
						"Invalid heartbleed(AccMgr) result code=" + err_code,
					);
				}
				ns.tprint("heartbleed log ", data.message);
			}
		}
	}
	async NIL(opts: AuthFlowState) {
		const ns = this.ns;
		type HeartbleedPasswordAttempt = {
			code: 401;
			message: string;
			passwordAttempted: string;
		};
		const info = opts.info;
		const { authDetails } = info;
		const chars = "0123456789".split("");
		const { passwordLength: len } = authDetails;
		const srv = info.server;
		const host = srv.hostname;
		const pw_arr = Array.from<string | null>({ length: len }).fill(null);
		for (const char of chars) {
			const pw = pw_arr.map((v) => v === null ? char : v).join("");
			const auth = await ns.dnet.authenticate(host, pw);
			if (this.submit_auth_result(opts, auth, pw)) break;
			const bleed_res = await ns.dnet.heartbleed(host);
			if (!bleed_res.success) {
				ns.tprint("heartbleed failed:", bleed_res);
				break;
			}
			for (const log of bleed_res.logs) {
				let data: HeartbleedPasswordAttempt | null = null;
				try {
					data = JSON.parse(log) as HeartbleedPasswordAttempt;
				} catch {
					ns.tprint("heartbleed text_log ", log);
				}
				if (!data) continue;
				if (data.code != 401) {
					throw new Error(
						"Invalid heartbleed(Nil) result code=" + data.code,
					);
				}
				const p = data.message.split(",");
				for (let i = 0; i < p.length; i++) {
					if (p[i] === "yes") pw_arr[i] = char;
				}
			}
		}
	}
	async BellaCuore(opts: AuthFlowState) {
		const num = decode_roman_num(opts.info.authDetails.data);
		await this.doAuth(opts, "" + num);
	}
	// overflow the buffer!
	async Pr0verFl0(opts: AuthFlowState) {
		const { info } = opts;
		const { authDetails: ad } = info;
		const { passwordLength: len } = ad;
		await this.doAuth(opts, "A".repeat(len * 2));
	}
	async OpenWebAccessPoint(opts: AuthFlowState) {
		const ad = opts.info.authDetails!;
		const pkt = await this.ns.dnet.packetCapture(opts.host);
		this.ns.tprint(
			"new OpenWeb auth flow for ",
			JSON.stringify(opts.info.server.hostname),
			" len=",
			ad.passwordLength,
		);
		this.ns.tprint("  hint ", JSON.stringify(ad.passwordHint));
		this.ns.tprint("  data ", ad.data);
		this.ns.tprint("  pkt ", pkt);
	}
	async Laika4(opts: AuthFlowState) {
		const ad = opts.info.authDetails;
		const hint = ad.passwordHint;
		this.ns.tprint("dog hint: ", opts.info.authDetails.passwordHint);
		this.ns.tprint(opts.info.authDetails);
		for (const dog_name of dog_names) {
			const pw = dog_name;
			if (pw.length != opts.info.authDetails.passwordLength) continue;
			const auth = await this.ns.dnet.authenticate(opts.host, pw);
			if (this.submit_auth_result(opts, auth, pw)) {
				this.dog_hint_map2[hint] ??= [];
				this.dog_hint_map[hint] ??= new Set();
				if (!this.dog_hint_map[hint].has(pw)) {
					this.dog_hint_map[hint].add(pw);
					this.dog_hint_map2[hint].push(pw);
				}
				break;
			}
		}
		this.ns.tprint("hint to res map ", this.dog_hint_map2);
	}
	dog_hint_map: Record<string, Set<string>> = {};
	dog_hint_map2: Record<string, string[]> = {};
}
function decode_model_id(id: string) {
	switch (id) {
		case "AccountsManager_4.2":
		case "BellaCuore":
		case "CloudBlare(tm)":
		case "DeepGreen":
		case "DeskMemo_3.1":
		case "Factori-Os":
		case "FreshInstall_1.0":
		case "Laika4":
		case "NIL":
		case "OctantVoxel":
		case "OpenWebAccessPoint":
		case "PHP 5.4":
		case "Pr0verFl0":
		case "ZeroLogon":
			return id;
		default:
			return null;
	}
}
function post_dnet_probe(
	ns: NS,
	infos: DarknetServerInfo[],
	infos_idx_map: Map<string, number>,
	runner: string,
) {
	for (const info of infos) {
		info.parent = null;
		info.connectedToParent = false;
	}
	const targets = ns.dnet.probe();
	for (const trg of targets) {
		const srv = ns.getServer(trg);
		if (!isDarknetServer2(srv)) continue;
		const ad = ns.dnet.getServerAuthDetails(trg);
		const info: DarknetServerInfo = {
			parent: runner,
			server: srv,
			authDetails: ad,
			password: null,
			connectedToParent: true,
		};
		if (infos_idx_map.has(trg)) {
			const i = infos_idx_map.get(trg)!;
			const prev_info = infos[i];
			infos[i] = info;
			if (prev_info.password !== null) {
				info.password = prev_info.password;
			}
			continue;
		}
		infos.push(info);
		infos_idx_map.set(trg, infos.length - 1);
	}
}

const SELF = "darknet_probe.ts";

export async function main(ns: NS) {
	ns.disableLog("dnet.probe");
	const infos: DarknetServerInfo[] = [];
	const infos_idx_map = new Map<string, number>();

	const f = ns.flags([["runner", "home"], ["threads", 1], ["port", 1]]) as {
		runner: string;
		threads: number;
		port: number;
		_: ScriptArg[];
	};
	if (f._.length > 0) {
		ns.tprint("too many arguments for dnet probe");
		return;
	}
	const runner = f.runner;
	const port = f.port;
	const local_probe = ns.dnet.probe();
	const dnet_files_dyn: string[] = [];
	dnet_files_dyn.push(SELF);
	dnet_files_dyn.push("lib/helper.ts");
	dnet_files_dyn.push("darknet/misc.ts");
	dnet_files_dyn.push("NetscriptDefinitions.d.ts");
	dnet_files_dyn.push(Darknet.MemoryReallocation);
	dnet_files_dyn.push(WithPort.Read);
	if (local_probe.length == 1 && local_probe[0] == "darkweb") {
		return ns.tprint("unable to start on home");
	}
	const am = new AuthManager(ns);
	for (;;) {
		post_dnet_probe(ns, infos, infos_idx_map, runner);
		for (let i = 0; i < infos.length; i++) {
			let info = infos[i];
			if (!info.connectedToParent) continue;
			const ad = info.authDetails;
			if (!ad) continue;
			if (ad.hasSession && info.password !== null) continue;
			const srv = info.server;
			const host = srv.hostname;
			const opts: AuthFlowState = { info, host, runner, port };
			ns.tprint(`enter auth for ${host} with modelId=${ad.modelId}`);
			const handler_id = decode_model_id(ad.modelId);
			// spell:words Factori-Os BellaCuore
			switch (handler_id) {
				case "Factori-Os":
					await am.Factori_0s(opts);
					break;
				case "AccountsManager_4.2":
					await am.AccountsManager(opts);
					break;
				case "CloudBlare(tm)":
					await am.CloudBlare(opts);
					break;
				case "DeskMemo_3.1":
					await am.DeskMemo(opts);
					break;
				case "FreshInstall_1.0":
					await am.FreshInstall(opts);
					break;
				case "Laika4":
					await am.Laika4(opts);
					break;
				case "PHP 5.4":
					await am.Php(opts);
					break;
				case "OctantVoxel":
					await am.OctantVoxel(opts);
					break;
				case "ZeroLogon":
					await am.doAuth(opts, "");
					break;
				default: {
					if (handler_id) {
						await am[handler_id]({
							info,
							host: host,
							runner,
							port,
						});
					} else {
						ns.tprint("no_handler=", { id: ad.modelId });
					}
				}
			}
			if (info.password === null) continue;
			ns.writePort(port, {
				type: "found_password",
				by: runner,
				for: host,
				password: info.password,
			} as DarknetFoundPassProbeMessage);
		}
		const online_infos = [];
		for (const info of infos) {
			if (info.server.isOnline) {
				online_infos.push(info);
			}
		}
		ns.writePort(port, {
			type: "darknet.probe",
			by: runner,
			infos: online_infos,
		} as DarknetProbeMessage);
		if (infos.length === 0) {
			ns.tprint("no results");
			break;
		}
		await ns.dnet.nextMutation();
	}
}
