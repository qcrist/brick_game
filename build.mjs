import * as esbuild from 'esbuild'

const production = process.argv[process.argv.length - 1] === "production";

const ctx = await esbuild.context({
    sourcemap: production ? undefined : "inline",
    entryPoints: ['src/index.tsx', 'src/main.css'],
    bundle: true,
    outdir: 'docs',
    minify: production
})

if (production) {
    await ctx.rebuild();
    await ctx.dispose();
} else
    await ctx.watch();

