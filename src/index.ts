
import Client from "smee-client";
import express from "express";
import { json } from "body-parser";
import { config } from "dotenv";
import { Octokit } from "@octokit/rest";
import { createAppAuth } from "@octokit/auth-app";
import { readFileSync } from "fs";
import { createChecklist, validateUserInput, statusCheck } from "./handlers";

async function runApp() {
  /////////////////////////// reading environment variables //////////////////////////
  config();
  const HOST: string = process.env.HOST!;
  const PORT: string = process.env.LISTENING_PORT!;
  const WEBHOOK_URL: string = process.env.SMEE_WEBHOOK_CHANNEL!;
  const PRIVATE_KEY_PATH: string = process.env.PRIVATE_KEY_PATH!;
  const APP_ID: string = process.env.APP_ID!;
  const APP_INSTALLATION_ID: string = process.env.APP_INSTALLATION_ID!;
  ////////////////////////////////////////////////////////////////////////////////////

  /////////////////////////// authenticating GitHub octokit api //////////////////////
  const private_key = readFileSync(PRIVATE_KEY_PATH, 'utf-8');
  const octokit = new Octokit({authStrategy: createAppAuth,
                               auth: {appId: APP_ID,
                                      privateKey: private_key,
                                      installationId: APP_INSTALLATION_ID}});
  /////////////////////////////////////////////////////////////////////////////////////

  ////////////////////////// connecting to the payload delivery service ///////////////
  let smee_client = new Client({
    source: WEBHOOK_URL,
    target: HOST + ':' + PORT + '/events',
    logger: console
  });
  smee_client.start();
  /////////////////////////////////////////////////////////////////////////////////////

  ///////////////////////// setting up server to listen for payload delivery //////////
  let exp = express();

  // json parsing for delivered payload
  exp.use(json());

  // associating handlers for payload type
  exp.post('/events', (req, res) => {
    try {
      const event = <string>(req.headers['x-github-event']);
      const action: string = req.body.action;

      switch (event + '.' + action) {
        case 'pull_request.opened': {
          createChecklist(octokit, req.body);
          break;
        }
        case 'issue_comment.edited': {
          validateUserInput(octokit, req.body);
          statusCheck(octokit, req.body);
          break;
        }
        case 'issue_comment.created': {
          statusCheck(octokit, req.body);
          break;
        }
      }

    } catch (error) {
      console.log(error);
    }
    res.status(200).end()
  })

  exp.listen(PORT, function () {
    console.log('Express listening at http://%s:%s', HOST, PORT)
  })
  /////////////////////////////////////////////////////////////////////////////////////
}

runApp();
