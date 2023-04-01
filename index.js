const path = require('path');
const fs = require('fs');
const { optimize } = require('svgo');
const { parser } = require('posthtml-parser');

const defaultSvgoOptions = {
  plugins: [
    {
      name: "preset-default",
      params: {
        overrides: {
          removeXMLNS: true,
          removeViewBox: false,
          removeDimensions: true
        }
      }
    }
  ],
};

const cache = {};

module.exports = function postHtmlInlineSvg(options = {}) {
  const cwd = options.cwd || process.cwd();
  const tag = options.tag || 'icon';
  const attr = options.attr || 'src';
  const optimizeWithOptions = svgString => optimize(svgString, options.svgo || defaultSvgoOptions)

  const localCache = {};

  const getSVG = (filePath) => {
    if (localCache[filePath]) {
      return localCache[filePath];
    }

    const stats = fs.statSync(filePath);
    const modifiedAt = stats.mtimeMs;

    if (cache[filePath] && cache[filePath].modifiedAt === modifiedAt) {
      localCache[filePath] = cache[filePath].data;
      return cache[filePath].data;
    }

    const fileData = fs.readFileSync(filePath, "utf8");
    const data = optimizeWithOptions(fileData).data;

    cache[filePath] = { data, modifiedAt };
    localCache[filePath] = data;

    return data;
  };

  return tree => {
    if (!tree.parser) tree.parser = parser;
    tree.match({ tag }, (node) => {
      const src = node.attrs[attr];
      const svg = getSVG(path.resolve(cwd, src));
      const nodes = parser(svg);
      const attrs = node.attrs;
      delete attrs[attr];

      Object.assign(nodes[0].attrs, attrs);
      node.tag = false;
      node.content = options.comment
        ? [`<!-- ${src} -->`, ...nodes]
        : nodes;
      return node;
    });

    return tree;
  };
};
