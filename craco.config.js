const webpack = require('webpack');
const path = require('path');

module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      // Polyfill fallbacks
      webpackConfig.resolve.fallback = {
        ...webpackConfig.resolve.fallback,
        stream: require.resolve('stream-browserify'),
        buffer: require.resolve('buffer'),
        crypto: require.resolve('crypto-browserify'),
        assert: require.resolve('assert'),
      };

      // Allow non-fully-specified imports (e.g. 'process/browser')
      // required by ESM packages like react-router >=7.12
      webpackConfig.module.rules.push({
        test: /\.m?js/,
        resolve: { fullySpecified: false },
      });

      // Provide globals
      webpackConfig.plugins.push(
        new webpack.ProvidePlugin({
          Buffer: ['buffer', 'Buffer'],
          process: 'process/browser',
        })
      );

      // Isolate pulse service into its own chunk so ad-blockers
      // cannot pattern-match it alongside the main bundle
      if (webpackConfig.optimization && webpackConfig.optimization.splitChunks) {
        const existingGroups =
          webpackConfig.optimization.splitChunks.cacheGroups || {};
        webpackConfig.optimization.splitChunks.cacheGroups = {
          ...existingGroups,
          pulse: {
            test: /[\\/]services[\\/]pulseService/,
            name: 'pulse',
            chunks: 'all',
            priority: 20,
            enforce: true,
          },
        };
      }

      return webpackConfig;
    },
  },
  // Dev-server (react-scripts start) overlay filter. troika-three-text (drei's
  // <Text>, used for the galaxy axis labels) generates glyph SDFs via WebGL and
  // blits them with ANGLE_instanced_arrays. On GPUs/contexts where that
  // extension is unavailable it throws "ANGLE_instanced_arrays not supported";
  // troika still renders labels via its JS fallback, so the error is benign —
  // but webpack-dev-server's runtime-error overlay pops a full-screen red box
  // over the app. Suppress that ONE error class in the overlay while keeping it
  // for every other runtime error. Dev-only; production has no such overlay.
  //
  // NOTE: `runtimeErrors` is stringified and shipped to the browser client, so
  // this function must be self-contained (no outer-scope references).
  devServer: (devServerConfig) => {
    const client =
      devServerConfig.client && typeof devServerConfig.client === 'object'
        ? devServerConfig.client
        : {};
    const overlay =
      client.overlay && typeof client.overlay === 'object' ? client.overlay : {};
    devServerConfig.client = {
      ...client,
      overlay: {
        ...overlay,
        runtimeErrors: (error) => {
          const msg = error && error.message ? error.message : String(error || '');
          if (
            /ANGLE_instanced_arrays not supported|WebGL (SDF )?generation not supported/.test(
              msg
            )
          ) {
            return false;
          }
          return true;
        },
      },
    };
    return devServerConfig;
  },
};
