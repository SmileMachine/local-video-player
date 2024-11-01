import chalk from 'chalk'

export const loggerMiddleware = (req, res, next) => {
  const timestamp = chalk.gray(`[${new Date().toISOString()}]`)
  const method = colorizeMethod(req.method)
  const url = chalk.blue(req.url)
  console.log(`${timestamp} ${method} ${url}`)
  next()
}

function colorizeMethod(method) {
  switch (method.toUpperCase()) {
    case 'GET':
      return chalk.green(method)
    case 'POST':
      return chalk.yellow(method)
    case 'PUT':
      return chalk.blue(method)
    case 'DELETE':
      return chalk.red(method)
    default:
      return chalk.white(method)
  }
} 
