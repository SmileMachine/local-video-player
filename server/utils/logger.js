import chalk from "chalk";
import path from "path";
import moment from "moment";
import util from "util";
import fs from "fs";

class Logger {
  static _log(message, options = {}) {
    if (options.file) {
      // dump json to file
      const logsDir = path.join(process.cwd(), "logs");
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir);
      }
      const fmessage = JSON.stringify(message, null, 2);
      const filePath = path.join(logsDir, `${options.file}`);
      fs.writeFileSync(filePath, fmessage);
      return;
    } 
    const formattedMessage =
      util.inspect(message, {
        depth: null, // 完全展开所有层级
        colors: true, // 启用颜色
        maxArrayLength: null, // 显示数组的所有元素
        compact: false, // 漂亮的多行输出
      });
    const stack = new Error().stack;
    const callerLine = stack.split("\n")[3]; // 3rd line is the caller
    const match = callerLine.match(/\((.+)\)/) || callerLine.match(/at (.+)/);
    const location = match ? match[1] : "unknown location";

    const timestamp = chalk.gray(`[${moment().format("YYYY-MM-DD HH:mm:ss")}]`);
    const locationInfo = chalk.cyan(`[${this.formatLocation(location)}]`);
    const level = options.level ? chalk.magenta(`[${options.level}]`) : "";
    const context = options.context ? chalk.yellow(`[${options.context}]`) : "";

    console.log(
      `${timestamp} ${locationInfo} ${level} ${context} ${formattedMessage}`
    );
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
