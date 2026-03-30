import { BitburnerPlugin } from "esbuild-bitburner-plugin";

await BitburnerPlugin({
  port: 12527,
  types: "servers/home/NetscriptDefinitions.d.ts",
  mirror: {
    "servers": ["home", "darkweb"],
  },
  distribute: {},
}).setup({
  initialOptions: {
    entryPoints: [
      "servers/**/*.ts",
    ],
    outbase: "./servers",
    outdir: "./build",
    bundle: true,
    format: "esm",
    platform: "browser",
    logLevel: "debug",
  },
  onDispose() {},
  onStart() {},
  onResolve() {},
  onLoad() {},
  onEnd() {},
});
