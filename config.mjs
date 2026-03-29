import { context } from "esbuild";
import { BitburnerPlugin } from "esbuild-bitburner-plugin";

const ctx = await context({
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
      port: 12527,
      types: void 0,
      mirror: {
        "servers": "all",
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
