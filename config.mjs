import { context } from "esbuild";
import { BitburnerPlugin } from "esbuild-bitburner-plugin";

const ctx = await context({
  entryPoints: [
    "servers/**/*.ts",
  ],
  outbase: "./servers",
  outdir: "./build",
  plugins: [
    BitburnerPlugin({
      port: 12527,
      types: "servers/home/NetscriptDefinitions.d.ts",
      mirror: {
        "servers": ["home", "darkweb"],
      },
      distribute: {},
    }),
  ],
  bundle: true,
  format: "esm",
  platform: "browser",
  logLevel: "debug",
});
ctx.watch();
