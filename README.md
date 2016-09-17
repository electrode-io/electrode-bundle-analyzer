# Electrode Bundle Analyzer

A [webpack] bundle analyzer that gives you a detail list of all the files that went into your deduped and minified bundle JS file.

If you use [webpack] to bundle your code and apply all the optimization to your production bundle output, then you get a very compact JS file that's impossible to read.

Do you wish you can get a list of what files made their way into that bundle after all the optimizations have been applied?  Well, this module will make your wish come true.
 
## Install

```bash
$ npm i electrode-bundle-analyzer --save-dev
```

## Usage

### Generating the Necessary Data

In order for this module to be able to make sense of your optimized bundle file, you need to preserve a comment that [webpack] inserted into the bundle which indicates the module ID, and save the `stats.json` from [webpack].

The module ID comment normally looks something like this:

```js
/***/ },
/* 1 */
/***/ function(module, exports, __webpack_require__) {
```

We want the line `/* 1 */` to be preserved.

It'd be looking something pretty mundane like this when it's preserved in the optimized bundle.

```js
 ... ))}},/* 1 */
function(e,t,n){"use strict";e.exports=n(2)},/* 2 */
function(e,t,n){ ...
```

Assuming you use [UglifyJsPlugin] to minify your bundle.  In order to preserve that line, add to the comments regex as indicated below.

To generate the `stats.json` file, one recommended plugin is the [webpack-stats-plugin].  Add it to your webpack config as indicated below.


```js
var optimize = require("webpack").optimize;
var StatsWriterPlugin = require("webpack-stats-plugin").StatsWriterPlugin;

var statsOptions = {
  filename: "stats.json",
  fields: null,
  transform: function (data) {
    data.modules.forEach(function (m) {
      delete m.source;
    });
    delete data.children;
    return JSON.stringify(data, null, 2);
  }
};

var webPackConfig = {
  plugins: [
    new optimize.UglifyJsPlugin({
      compress: {
        warnings: false
      },
      comments: /^\**!|^ [0-9]+ $|@preserve|@license/
    }),
    new StatsWriterPlugin(statsOptions)
  ]
};
```

### Analyze

Once you have the bundle and stats files, you can generate detail module files from them.

The simple command is:

```bash
$ analyze-bundle -b bundle.js -s stats.json
```

You can run it without any options or `-h` to get full usage output:

```
Usage: analyze-bundle --bundle [bundle.js] --stats [stats.json] --dir [output_dir] --rewrite

Options:
  -b, --bundle   JS bundle file from webpack                          [required]
  -s, --stats    stats JSON file from webpack[default: "dist/server/stats.json"]
  -r, --rewrite  rewrite the bundle file with module ID comments removed
  -d, --dir      directory to write the analyze results       [default: ".etmp"]
  -h, --help     Show help                                             [boolean]
```

With the rewrite option, you can remove the module ID comments from your optimized bundle after it's been analyzed.

If you don't specify an output directory, a default one `.etmp` will be created and a `.gitignore` file is also added there to avoid git picking it up.

Two files will be written to the output directory:

  - `bundle.analyze.json`
  - `bundle.analyze.tsv`

The `tsv` file is a Tab Separated Values text file that you can easily import into a spreadsheet for viewing.

For example:

```
Module ID       Full Path       Identity Path   Size (bytes)
0       ./client/app.jsx        ./client/app.jsx  328
1       ./~/react/react.js      ~/react/react.js        46
2       ./~/react/lib/React.js  ~/react/lib/React.js    477
3       ./~/object-assign/index.js      ~/object-assign/index.js        984
4       ./~/react/lib/ReactChildren.js  ~/react/lib/ReactChildren.js    1344
```

The `~` is a replacement for `node_modules`.

### Using the Result

The best way to make use of the result is to import the `tsv` file into a spreadsheet and sort the `Identity Path` column.  Any duplicate entries there means you are pulling multiple versions of the same module into your bundle.

TBD: We plan to add more feature to generate a summary report from the analyze results.

[webpack]: https://webpack.github.io/
[UglifyJsPlugin]: https://webpack.github.io/docs/list-of-plugins.html#uglifyjsplugin
[webpack-stats-plugin]: https://github.com/FormidableLabs/webpack-stats-plugin
