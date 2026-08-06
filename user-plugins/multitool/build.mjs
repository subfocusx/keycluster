import * as esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['index.ts'],
  bundle: true,
  format: 'esm',
  outfile: 'index.js',
  alias: {
    react: './lib/react-shim.ts',
    'plugin-sdk': './lib/sdk-shim.ts',
  },
  jsx: 'transform',
  jsxFactory: 'React.createElement',
  jsxFragment: 'React.Fragment',
  target: 'es2020',
});
