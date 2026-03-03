import { BuildOptions, context } from "esbuild";
import { BitburnerPlugin } from "esbuild-bitburner-plugin";

const config: BuildOptions = {
  entryPoints: [
    "servers/**/*.js",
    "servers/**/*.jsx",
    "servers/**/*.ts",
    "servers/**/*.tsx",
  ],
  outbase: "./servers",
  outdir: "./build",
  plugins: [
    BitburnerPlugin({
      port: 12525,
      types: "NetscriptDefinitions.d.ts",
      mirror: {},
      distribute: {},
      extensions: []
    }),
  ],
  bundle: true,
  format: "esm",
  platform: "browser",
  logLevel: "debug",
};

if (import.meta.main) {
  const ctx = await context(config);
  ctx.watch();
}
