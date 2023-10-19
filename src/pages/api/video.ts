import type { NextApiRequest, NextApiResponse } from "next";

import { Client } from "youtubei";
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<any>
) {
  if (req.method === "POST") {
    const youtube = new Client();
    const { id } = req.body;
    const items = {};
    const response = await youtube.getVideo(id);
    console.log(response);
    
    res.status(200).json('ok');
  } else {
    res.status(405).end(); 
  }
}
