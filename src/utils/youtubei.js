import { Client } from "youtubei";
import axios from "axios";

// Setup proxy
const proxy = {
  host: 'p.webshare.io',
  port: 80,
  auth: {
    username: 'pcjknuyq-1',
    password: 'vudo1aje0vls'
  },
};

// Create a custom Axios instance with proxy settings
const axiosInstance = axios.create({
  proxy: proxy,
  headers: {
    'User-Agent': 'Mozilla/5.0'
  }
});

// Pass custom Axios instance to youtubei client
const youtubei = new Client({ axiosInstance });

// export the youtube client
export default youtubei;
