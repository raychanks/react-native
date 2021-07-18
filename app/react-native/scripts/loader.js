const path = require('path');
const fs = require('fs');
const glob = require('glob');

function requireUncached(module) {
  delete require.cache[require.resolve(module)];
  return require(module);
}

function getMainPath() {
  const cwd = process.cwd();
  return path.join(cwd, '.storybook/main.js');
}

function getPreviewPath() {
  const cwd = process.cwd();
  return path.join(cwd, '.storybook/preview.js');
}

function getPreviewExists() {
  return fs.existsSync(getPreviewPath());
}

function getGlobs() {
  // we need to invalidate the cache because otherwise the latest changes don't get loaded
  const { stories: storyGlobs } = requireUncached(getMainPath());

  return storyGlobs;
}

function getAddons() {
  const { addons } = requireUncached(getMainPath());

  return addons;
}

function getPaths() {
  return getGlobs().reduce((acc, storyGlob) => {
    const paths = glob.sync(storyGlob);
    return [...acc, ...paths];
  }, []);
}

function writeRequires() {
  const cwd = process.cwd();

  const storyPaths = getPaths();
  const addons = getAddons();

  fs.writeFileSync(path.join(cwd, '/storybook.requires.js'), '');

  const previewExists = getPreviewExists();
  let previewJs = previewExists
    ? `
import { decorators, parameters } from './.storybook/preview';
if (decorators) {
  decorators.forEach((decorator) => addDecorator(decorator));
}
if (parameters) {
  addParameters(parameters);
}`
    : '';

  const storyRequires = storyPaths.map((storyPath) => `\t\trequire("${storyPath}")`).join(', \n');
  const path_array_str = `[\n${storyRequires}\n\t]`;

  const registerAddons = addons.map((addon) => `import "${addon}/register";`).join('\n');
  let enhancers = '';

  // TODO: implement presets or something similar
  if (addons.includes('@storybook/addon-ondevice-actions')) {
    enhancers = `import { argsEnhancers } from '@storybook/addon-actions/dist/modern/preset/addArgs';
argsEnhancers.forEach(enhancer => addArgsEnhancer(enhancer))`;
  }

  const fileContent = `
/*
  do not change this file, it is auto generated by storybook.
*/
import { configure, addDecorator, addParameters, addArgsEnhancer } from '@storybook/react-native';
${registerAddons}

${enhancers}

${previewJs}

const getStories=() => {
  return ${path_array_str};
}
configure(getStories, module, false)

  `;

  fs.writeFileSync(path.join(cwd, '/storybook.requires.js'), fileContent, {
    encoding: 'utf8',
    flag: 'w',
  });
}

module.exports = {
  writeRequires,
  getGlobs,
  getMainPath,
  getPreviewExists,
  getPreviewPath,
};
