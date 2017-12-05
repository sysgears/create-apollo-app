export const parseProjectSnapshotGeneratorArgs = () => {
  const result: any = parseJsonFromProcessArgs();

  if (result.targetArchs) {
    result.targetArchs = parseStringArray(result.targetArchs);
  }
  if (result.tnsJavaClassesOptions && result.tnsJavaClassesOptions.packages !== undefined) {
    result.tnsJavaClassesOptions.packages = parseStringArray(result.tnsJavaClassesOptions.packages);
  }
  if (result.tnsJavaClassesOptions && result.tnsJavaClassesOptions.modules !== undefined) {
    result.tnsJavaClassesOptions.modules = parseStringArray(result.tnsJavaClassesOptions.modules);
  }

  if (result.useLibs !== undefined) {
    result.useLibs = parseBool(result.useLibs);
  }

  if (result.install !== undefined) {
    result.install = parseBool(result.install);
  }

  return result;
};

function parseJsonFromProcessArgs() {
  const args = process.argv.slice(2);
  const result = {};

  let currentKey = '';
  let currentValue = '';
  args.forEach((value: any, index: any, array: any) => {
    if (value.startsWith('--')) {
      // if is key
      addKeyAndValueToResult(currentKey, currentValue, result);
      currentKey = value.slice(2);
      currentValue = null;
    } else {
      // if is first value
      currentValue = currentValue === null ? value : `${currentValue} ${value}`;
    }

    if (index === array.length - 1) {
      // if is the last one
      addKeyAndValueToResult(currentKey, currentValue, result);
    }
  });

  return result;
}

function addKeyAndValueToResult(key: any, value: any, result: any) {
  if (!key) {
    return;
  }

  const jsValue = value === null ? null : value.toString();
  const keyPath = key.split('.');
  let parentObject = result;

  keyPath.forEach((kp: any, i: number) => {
    if (i === keyPath.length - 1) {
      parentObject[kp] = jsValue;
    } else {
      parentObject[kp] = parentObject[kp] || {};
      parentObject = parentObject[kp];
    }
  });
}

function parseBool(value: any) {
  return value === null || value === 'true';
}

function parseStringArray(str: string) {
  return str.split(',').map(value => value.trim());
}
