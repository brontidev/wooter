import { build } from "@deno/dnt"
import esbuild from "esbuild"
import { dtsPlugin } from "esbuild-plugin-d.ts"

console.log("1. Running dnt")
await build({
	entryPoints: ["./src/export/index.ts"],
	outDir: "./out/temp",
	shims: {},
	package: {},
	test: false,
	typeCheck: false,
	scriptModule: false,
})

console.log("2. Applying compat changes")
Deno.writeTextFileSync("./out/temp/src/index.ts", 'export * from "./export/index.js"')
Deno.writeTextFileSync("./out/temp/src/_dnt.polyfills.ts", "export {};", { append: true })

console.log("3. Generating bundle & d.ts")

await esbuild.build({
	entryPoints: ["./out/temp/src/index.ts"],
	outfile: "./out/index.js",
	bundle: true,
	format: "esm",
	plugins: [dtsPlugin({
		experimentalBundling: true,
		tsconfig: {
			compilerOptions: {
				outDir: "./out",
				lib: ["esnext", "es2022", "dom"],
				target: "es2017",
				module: "esnext",
			},
		},
	})],
})
console.log("4. Generating minified bundle")

await esbuild.build({
	entryPoints: ["./out/temp/src/index.ts"],
	outfile: "./out/index.m.js",
	bundle: true,
	minify: true,
	format: "esm",
})

console.log("5. Cleaning")
Deno.removeSync("./out/temp", { recursive: true })
