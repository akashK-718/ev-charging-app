const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// Load the real TypeScript module with explicit adapters. Unknown imports fail
// closed so these isolated tests cannot accidentally reach live providers.
exports.loadHandler = function loadHandler(relativePath, adapters = {}) {
  const filename = path.resolve(__dirname, '../../..', relativePath);
  const source = fs.readFileSync(filename, 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    fileName: filename,
  });
  const module = { exports: {} };
  const restrictedRequire = name => {
    if (Object.hasOwn(adapters, name)) return adapters[name];
    throw new Error(`Provide an explicit test adapter for ${name}`);
  };
  const run = vm.runInThisContext(
    `(function(require, module, exports) { ${outputText}\n})`,
    { filename },
  );
  run(restrictedRequire, module, module.exports);
  return module.exports;
};
