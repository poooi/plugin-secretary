module.exports = {
  'env': {
    'browser': true,
    'es6': true,
    'node': true,
  },
  'extends': [
    "airbnb",
    "prettier",
    "prettier/react",
    "poi-plugin",
  ],
  'parser': 'babel-eslint',
  'plugins': [
    'import',
    'react',
    'prettier',
  ],
  'globals': {
    "window": false,
    "config": false,
  },
  'rules': {
    'import/no-unresolved': [2, { 'ignore': ['views/.*'] }],
    'react/jsx-filename-extension': 'off',
    'no-underscore-dangle': ['error', { 'allow': ['__'], 'allowAfterThis': true }],
    'import/extensions': ['error', { 'es': 'never' }],
    'import/no-extraneous-dependencies': 'off',
    'camelcase': 'off',
    'no-confusing-arrow': 'off',
    'react/require-default-props': 'off',
    'no-console': ['error', {allow: ['warn', 'error']}],
    'function-paren-newline': 'off',
    'jsx-a11y/click-events-have-key-events': 'off',
    'react/no-multi-comp': 'off',
    'react/forbid-prop-types': 'off',
    'no-underscore-dangle': 'off',
    "prettier/prettier": "error",
  },
  'settings': {
    'import/resolver': {
      'node': {
        'extensions': ['.js', '.jsx', '.es'],
        'paths': [__dirname],
      },
    },
    'import/core-modules': [
      'electron',
      'react',
      'react-dom',
      'react-redux',
      'redux',
      'redux-observers',
      'reselect',
      'react-bootstrap',
      'react-fontawesome',
      'path-extra',
      'fs-extra',
      'lodash',
      'cson',
      'fast-memoize',
      'classnames',
      'i18n-2',
      'semver',
      'react-virtualized',
      'prop-types',
      'fuse.js',
      'react-overlays',
    ],
  },
}
