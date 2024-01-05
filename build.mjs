import * as esbuild from 'esbuild'

const ctx = await esbuild.context({
    sourcemap: "inline",
    entryPoints: ['src/index.tsx', 'src/main.css'],
    bundle: true,
    outdir: 'dist'
})

await ctx.watch();

