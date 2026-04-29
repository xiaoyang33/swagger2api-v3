/**
 * 将路径转换为小驼峰命名的函数名
 * @param method HTTP方法
 * @param path 接口路径
 * @returns 小驼峰命名的函数名
 */
export function pathToFunctionName(method: string, path: string): string {
  const cleanPath = path.replace(/\{([^}]+)\}/g, '$1');
  const segments = cleanPath.split('/').filter((segment) => segment.length > 0);
  const pathParts = segments.map((part, index) => {
    const cleanPart = part.replace(/[^a-zA-Z0-9]/g, '');
    if (index === 0) {
      return cleanPart.toLowerCase();
    }
    return cleanPart.charAt(0).toUpperCase() + cleanPart.slice(1).toLowerCase();
  });
  const methodSuffix =
    method.charAt(0).toUpperCase() + method.slice(1).toLowerCase();
  const baseName = pathParts.join('');
  return baseName + methodSuffix;
}

/**
 * 将字符串转换为kebab-case
 * @param str 输入字符串
 * @returns kebab-case字符串
 */
export function toKebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

/**
 * 将字符串转换为PascalCase
 * @param str 输入字符串
 * @returns PascalCase字符串
 */
export function toPascalCase(str: string): string {
  return str
    .replace(/[\s-_]+(.)?/g, (_, char) => (char ? char.toUpperCase() : ''))
    .replace(/^(.)/, (char) => char.toUpperCase());
}

/**
 * 将字符串转换为camelCase
 * @param str 输入字符串
 * @returns camelCase字符串
 */
export function toCamelCase(str: string): string {
  const pascalCase = toPascalCase(str);
  return pascalCase.charAt(0).toLowerCase() + pascalCase.slice(1);
}

/**
 * 从方法名中移除指定的前缀
 * @param methodName 方法名
 * @param prefixes 需要移除的前缀数组
 * @returns 移除前缀后的方法名
 */
export function stripMethodNamePrefixes(
  methodName: string,
  prefixes?: string[]
): string {
  if (!prefixes || prefixes.length === 0) {
    return methodName;
  }

  let result = methodName;
  let changed = true;
  while (changed) {
    changed = false;
    for (const prefix of prefixes) {
      if (!prefix) continue;

      const camelPrefix = toCamelCase(prefix);
      const lowerMethodName = result.toLowerCase();
      const lowerPrefix = camelPrefix.toLowerCase();

      if (lowerMethodName.startsWith(lowerPrefix)) {
        const remaining = result.substring(camelPrefix.length);
        if (remaining.length > 0) {
          result = remaining.charAt(0).toLowerCase() + remaining.slice(1);
          changed = true;
          break;
        }
      }
    }
  }

  return result;
}

/**
 * 从函数名中移除 HTTP method 后缀
 * @param functionName 函数名
 * @param method HTTP 方法
 * @returns 移除后缀后的函数名
 */
export function removeMethodSuffix(
  functionName: string,
  method: string
): string {
  const methodSuffix =
    method.charAt(0).toUpperCase() + method.slice(1).toLowerCase();

  if (functionName.endsWith(methodSuffix)) {
    return functionName.slice(0, -methodSuffix.length);
  }

  return functionName;
}

/**
 * 清理文件名，移除非法字符
 * @param filename 文件名
 * @returns 清理后的文件名
 */
export function sanitizeFilename(filename: string): string {
  return filename.replace(/[<>:"/\\|?*]/g, '-').replace(/\s+/g, '-');
}

/**
 * 清理类型名称并转换为 PascalCase
 * @param name 类型名称
 * @returns 清理后的类型名称
 */
export function sanitizeTypeName(name: string): string {
  if (!name) return name;
  const replaced = name.replace(/[^a-zA-Z0-9_]/g, '_');
  return toPascalCase(replaced);
}
