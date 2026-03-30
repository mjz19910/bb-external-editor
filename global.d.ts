import {
  AutocompleteData as _AutocompleteData,
  DarknetResult as _DarknetResult,
  DarknetServerData as _DarknetServerData,
  NS as _NS,
  Player as _Player,
  ScriptArg as _ScriptArg,
  Server as _Server,
} from "./servers/home/NetscriptDefinitions";

declare global {
  type AutocompleteData = _AutocompleteData;
  type DarknetResult = _DarknetResult;
  type DarknetServerData = _DarknetServerData;
  type NS = _NS;
  type Player = _Player;
  type ScriptArg = _ScriptArg;
  type Server = _Server;
}
