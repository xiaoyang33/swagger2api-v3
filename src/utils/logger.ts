/**
 * 轻量级终端日志工具（零依赖，基于 ANSI 转义码）
 */

/** 终端是否支持颜色输出 */
const supportsColor =
  process.stdout.isTTY &&
  process.env.NODE_ENV !== 'test' &&
  process.env.NO_COLOR === undefined;

/** 日志左侧缩进 */
const INDENT = '  ';

/** 列表标签默认宽度 */
const LIST_LABEL_WIDTH = 22;

/** 日志图标 */
const icon = {
  success: '✅',
  info: 'ℹ',
  warn: '⚠',
  error: '❌',
  debug: '·',
  path: '📂',
  bullet: '•'
};

/**
 * 包裹 ANSI 颜色码
 * @param code ANSI 转义码
 * @param text 文本内容
 * @returns 带颜色的字符串（不支持颜色时返回原文）
 */
function wrap(code: string, text: string): string {
  return supportsColor ? `\x1b[${code}m${text}\x1b[0m` : text;
}

/** 颜色与样式快捷方法 */
const style = {
  /**
   * 加粗文本
   * @param text 文本内容
   * @returns 格式化后的文本
   */
  bold(text: string): string {
    return wrap('1', text);
  },

  /**
   * 弱化文本
   * @param text 文本内容
   * @returns 格式化后的文本
   */
  dim(text: string): string {
    return wrap('2', text);
  },

  /**
   * 绿色文本
   * @param text 文本内容
   * @returns 格式化后的文本
   */
  green(text: string): string {
    return wrap('32', text);
  },

  /**
   * 黄色文本
   * @param text 文本内容
   * @returns 格式化后的文本
   */
  yellow(text: string): string {
    return wrap('33', text);
  },

  /**
   * 紫色文本
   * @param text 文本内容
   * @returns 格式化后的文本
   */
  magenta(text: string): string {
    return wrap('35', text);
  },

  /**
   * 青色文本
   * @param text 文本内容
   * @returns 格式化后的文本
   */
  cyan(text: string): string {
    return wrap('36', text);
  },

  /**
   * 灰色文本
   * @param text 文本内容
   * @returns 格式化后的文本
   */
  gray(text: string): string {
    return wrap('90', text);
  }
};

/**
 * 日志工具类
 *
 * 提供统一的、带颜色的终端输出格式。
 * error 方法不使用颜色码，确保 console.error 的参数为纯文本，
 * 兼容测试中对 console.error 的 spy 断言。
 */
class Logger {
  private step = 0;
  private totalSteps = 0;

  /**
   * 写入标准输出
   * @param message 输出内容
   */
  private log(message = ''): void {
    console.log(message);
  }

  /**
   * 写入错误输出
   * @param message 输出内容
   */
  private fail(message: string): void {
    console.error(message);
  }

  /**
   * 格式化未知错误
   * @param error 错误对象
   * @returns 错误文案
   */
  private formatError(error: unknown): string {
    if (error instanceof Error) {
      return error.message ? `${error.name}: ${error.message}` : error.name;
    }

    return String(error);
  }

  /**
   * 输出带图标的状态行
   * @param symbol 状态图标
   * @param message 消息内容
   */
  private status(symbol: string, message: string): void {
    this.log(`${INDENT}${symbol}  ${message}`);
  }

  /**
   * 设置总步骤数
   * @param n 步骤总数
   */
  setTotalSteps(n: number): void {
    this.totalSteps = n;
    this.step = 0;
  }

  /**
   * 输出步骤标题
   * @param emoji 步骤图标
   * @param title 步骤标题
   */
  stepTitle(emoji: string, title: string): void {
    this.step++;
    const progress =
      this.totalSteps > 0
        ? style.dim(`[${this.step}/${this.totalSteps}] `)
        : '';
    this.log();
    this.log(`${INDENT}${progress}${emoji}  ${style.bold(title)}`);
  }

  /**
   * 输出成功信息
   * @param message 消息内容
   */
  success(message: string): void {
    this.status(style.green(icon.success), message);
  }

  /**
   * 输出信息
   * @param message 消息内容
   */
  info(message: string): void {
    this.status(style.cyan(icon.info), message);
  }

  /**
   * 输出文件/路径信息
   * @param label 标签
   * @param path 路径
   */
  path(label: string, path: string): void {
    this.status(icon.path, `${style.dim(label)}: ${style.bold(path)}`);
  }

  /**
   * 输出警告信息
   * @param message 消息内容
   */
  warn(message: string): void {
    this.status(style.yellow(icon.warn), message);
  }

  /**
   * 输出错误信息（不使用颜色码，兼容测试断言）
   * @param message 消息内容
   * @param error 错误对象
   */
  error(message: string, error?: unknown): void {
    const detail =
      error === undefined ? message : `${message}: ${this.formatError(error)}`;
    this.fail(`${icon.error} ${detail}`);
  }

  /**
   * 输出错误列表
   * @param title 错误标题
   * @param items 错误项列表
   */
  errorList(title: string, items: string[]): void {
    this.fail(`${icon.error} ${title}`);
    items.forEach((item) => this.fail(`${INDENT} - ${item}`));
  }

  /**
   * 输出调试信息（灰色暗淡）
   * @param message 消息内容
   */
  debug(message: string): void {
    this.status(style.gray(icon.debug), style.gray(message));
  }

  /**
   * 输出调试键值对
   * @param key 键名
   * @param value 键值
   */
  debugKV(key: string, value: string | number | boolean): void {
    this.status(
      style.gray(icon.debug),
      `${style.gray(key)}: ${style.gray(String(value))}`
    );
  }

  /**
   * 输出列表项
   * @param label 列表项标签
   * @param detail 列表项详情
   */
  listItem(label: string, detail: string): void {
    const paddedLabel = label.padEnd(LIST_LABEL_WIDTH, ' ');
    this.log(
      `${INDENT}   ${style.dim(icon.bullet)} ${style.cyan(paddedLabel)} ${style.dim(detail)}`
    );
  }

  /**
   * 输出分隔线
   */
  divider(): void {
    const line = '─'.repeat(48);
    this.log(`${INDENT}${style.dim(line)}`);
  }

  /**
   * 输出横幅标题
   * @param title 标题
   * @param subtitle 副标题（可选）
   */
  banner(title: string, subtitle?: string): void {
    this.log();
    this.log(`${INDENT}${style.bold(style.magenta(title))}`);
    if (subtitle) {
      this.log(`${INDENT}${style.dim(subtitle)}`);
    }
    this.log();
  }

  /**
   * 输出完成横幅
   * @param message 完成消息
   */
  done(message: string): void {
    this.log();
    this.log(`${INDENT}${style.green(icon.success)}  ${style.bold(message)}`);
    this.log();
  }
}

/** 日志单例 */
export const logger = new Logger();
