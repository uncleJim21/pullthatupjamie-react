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
};
