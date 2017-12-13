function fixRelativeImports(fileName, source) {
    let result = source;

    result = result.replace(/(\.\.\/)+platform\'/g, 'platform\'');
    result = result.replace(/(\.\.\/)+ui\/frame\'/g, 'ui/frame\'');
    result = result.replace(/(\.\.\/)+ui\/page\'/g, 'ui/page\'');

    return result;
}


module.exports = function (source, map) {
    this.cacheable();
    var resultSource = fixRelativeImports(this.resource, source);
    this.callback(null, resultSource, map);
};