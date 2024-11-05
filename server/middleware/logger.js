import chalk from "chalk";
import moment from "moment";

export const loggerMiddleware = (req, res, next) => {
  const timestamp = chalk.gray(`[${moment().format("YYYY-MM-DD HH:mm:ss.SSS")}]`);
  const method = colorizeMethod(req.method);
  const decodedUrl = decodeURIComponent(req.url);
  const url = chalk.blue(decodedUrl);
  console.log(`${timestamp} ${method} ${url}`);
  next();
};

function colorizeMethod(method) {
  switch (method.toUpperCase()) {
    case "GET":
      return chalk.green(method);
    case "POST":
      return chalk.yellow(method);
    case "PUT":
      return chalk.blue(method);
    case "DELETE":
      return chalk.red(method);
    default:
      return chalk.white(method);
  }
}
