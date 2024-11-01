import chalk from "chalk";
import path from "path";
import moment from "moment";
import util from "util";

class Logger {
  static _log(message, options = {}) {
    const formattedMessage =
      // typeof message === "object"
      // ?
      util.inspect(message, {
        depth: null, // 完全展开所有层级
        colors: true, // 启用颜色
        // maxArrayLength: null, // 显示数组的所有元素
        compact: false, // 漂亮的多行输出
      });
    // : message;
    const stack = new Error().stack;
    const callerLine = stack.split("\n")[3];
    const match = callerLine.match(/\((.+)\)/) || callerLine.match(/at (.+)/);
    const location = match ? match[1] : "unknown location";

    const timestamp = chalk.gray(`[${moment().format("YYYY-MM-DD HH:mm:ss")}]`);
    const locationInfo = chalk.cyan(`[${this.formatLocation(location)}]`);
    const level = options.level ? chalk.magenta(`[${options.level}]`) : "";
    const context = options.context ? chalk.yellow(`[${options.context}]`) : "";
    if (options.file) {
      // dump json to file
      fs.writeFileSync(options.file, formattedMessage);
    } else {
      console.log(
        `${timestamp} ${locationInfo} ${level} ${context} ${formattedMessage}`
      );
    }
  }

  static formatLocation(location) {
    try {
      const rootDir = process.cwd();
      const fullPath = location.replace(/\\/g, "/");
      const relativePath = fullPath.includes(rootDir)
        ? path.relative(rootDir, fullPath)
        : fullPath;

      const match = relativePath.match(/([^/\\]+:\d+:\d+)$/);
      return match ? match[1] : relativePath;
    } catch (error) {
      return location;
    }
  }
}

export const logger = {
  error: (message, file) => {
    Logger._log(message, { level: chalk.red("ERROR"), file });
  },

  warn: (message, file) => {
    Logger._log(message, { level: chalk.yellow("WARN"), file });
  },

  info: (message, file) => {
    Logger._log(message, { level: chalk.blue("INFO"), file });
  },

  success: (message, file) => {
    Logger._log(message, { level: chalk.green("SUCCESS"), file });
  },

  debug: (message, file) => {
    if (process.env.NODE_ENV === "development") {
      Logger._log(message, { level: chalk.gray("DEBUG"), file });
    }
  },
};
