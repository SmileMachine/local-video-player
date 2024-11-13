export default {
  port: process.env.PORT || 3000,
  host: process.env.HOST || "localhost",
  nodeEnv: process.env.NODE_ENV || "development",
  getInfo: process.env.GET_VID_INFO || false,
};
