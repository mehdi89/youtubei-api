import { Client } from "youtubei";
import axios from "axios";

// Create an axios instance with browser-like headers
const axiosInstance = axios.create({
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
  }
});

// Create youtubei client with custom configuration
const youtubei = new Client({ 
  axiosInstance,
  requestOptions: {
    gl: 'US',
    hl: 'en'
  }
});

// export the youtube client
export default youtubei;
