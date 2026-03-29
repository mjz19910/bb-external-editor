export type BasicHostInfo = {
  host: string;
  parent: string | null;
  children: string[];
  server_info: Server;
  extended_info: ExtendedInfo;
}
export type HostInfo = BasicHostInfo & {
  is_new: boolean;
}
export type SaveHost = BasicHostInfo & {
  is_new?: boolean;
}
export type ExtendedInfo = {
  hack_time: number;
}