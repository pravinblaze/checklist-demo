
import Client from "smee-client";
import express from "express";
import BodyParser from "body-parser";
import DotenvConfigOptions from "dotenv";


DotenvConfigOptions.config();

const HOST: string = process.env.HOST!;
const PORT: string = process.env.LISTENING_PORT!;
const WEBHOOK_URL: string = process.env.SMEE_WEBHOOK_CHANNEL!;

let client = new Client({
  source: WEBHOOK_URL,
  target: HOST + ':' + PORT + '/events',
  logger: console
});

client.start();

let exp = express();

exp.use(BodyParser.json());

exp.post("/events", (req, res) => {
  // TODO: appropriate handler functions for interested payloads
  console.log(req.body)
  res.status(200).end()
})

exp.listen(PORT, function () {
   console.log("Express listening at http://%s:%s", HOST, PORT)
})
