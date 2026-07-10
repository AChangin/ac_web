const esbuild = require("esbuild");

const isWatch = process.argv.includes("--watch");

/** @type {import("esbuild").BuildOptions} */
const config = {
  entryPoints: ["src/main.tsx"],
  bundle: true,
  outfile: "public/logo-bundle.js",
  format: "iife",
  globalName: "LogoApp",
  jsx: "automatic",
  loader: {
    ".tsx": "tsx",
    ".ts": "ts",
    ".jsx": "jsx",
    ".js": "js",
  },
  sourcemap: true,
  minify: false,
  target: ["es2020"],
  define: {
    "process.env.NODE_ENV": '"production"',
  },
  // Bundle everything for self-contained output (no CDN needed)
};

async function main() {
  if (isWatch) {
    const ctx = await esbuild.context(config);
    await ctx.watch();
    console.log("[build] Watching for changes...");
  } else {
    await esbuild.build(config);
    console.log("[build] Build complete → public/logo-bundle.js");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
