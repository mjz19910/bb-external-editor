import {
  AutocompleteData as _AutocompleteData,
  NS as _NS,
  ScriptArg as _ScriptArg,
} from "./servers/home/NetscriptDefinitions";

declare global {
  type AutocompleteData = _AutocompleteData;
  type NS = _NS;
  type ScriptArg = _ScriptArg;
}
