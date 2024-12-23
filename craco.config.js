const webpack = require('webpack');

module.exports = {
  webpack: {
    configure: {
      resolve: {
        fallback: {
          stream: require.resolve('stream-browserify'),
          buffer: require.resolve('buffer'),
          crypto: require.resolve('crypto-browserify'),
          assert: require.resolve('assert'),
        },
      },
      plugins: [
        new webpack.ProvidePlugin({
          Buffer: ['buffer', 'Buffer'],
          process: 'process/browser',
        }),
      ],
    },
  },
};
