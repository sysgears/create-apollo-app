module.exports = {
  compact: false,
  presets: ['babel-preset-expo'],
  plugins: [
    'haul/src/utils/fixRequireIssues'
  ],
  env: {
    production: {
      compact: true
    }
  }
};