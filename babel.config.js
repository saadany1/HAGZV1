module.exports = function(api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'react' }]
    ],
    plugins: [
      'react-native-worklets/plugin',
      ['@babel/plugin-proposal-decorators', { legacy: true }],
      ['@babel/plugin-transform-flow-strip-types'],
      ['@babel/plugin-transform-class-properties', { loose: true }]
    ],
  };
};











