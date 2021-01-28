
import { Octokit } from "@octokit/rest"

import { files } from "./review_items";

// invisible delimiter for parsing and identifying bot comments
const nline = '\r\n';
const delimiter = '<!-- checklist-bot delimiter -->'.concat(nline);
const checkbox_separator = '<!-- checkbox separator -->'.concat(nline);

async function createChecklist(octokit: Octokit, payload: any) {
  const owner: string = payload.repository.owner.login;
  const repo: string = payload.repository.name;
  const pull_number: number = payload.number;

  // retrieving pull request files
  let response = await octokit.pulls.listFiles({owner: owner,
                                                repo: repo,
                                                pull_number: pull_number});
  let pr_files = response.data.map(function (e) {return e.filename;});

  let comment_body: string = delimiter;
  const initial_status = '- [ ] done' +nline+ '- [ ] skipped; rationale : [enter text here]' +nline;

  // building comment body with review checks for each file
  for (let i = 0; i < pr_files.length; i++) {
    let filename = pr_files[i];
    if (files.hasOwnProperty(filename)) {
      let checks = files[filename];
      for (let j = 0; j < checks.length; j++) {
        if (!comment_body.includes(checks[j])) {
          comment_body = comment_body.concat('#### ', checks[j], nline,
                                              checkbox_separator,
                                              initial_status,
                                              delimiter);
        }
      }
    }
  }

  // creating comment
  await octokit.issues.createComment({owner: owner, repo: repo,
                                      issue_number: pull_number, body: comment_body});
}

async function validateUserInput(octokit: Octokit, payload: any) {
  // proceed only in case of a PR and edit of bot's comment
  if (!payload.issue.pull_request ||
      !payload.changes.body.from.includes(delimiter)) {
    return;
  }

  const owner: string = payload.repository.owner.login;
  const repo: string = payload.repository.name;
  const pull_number: number = payload.issue.number;

  // & lookup the PR it's for to continue
  let response = await octokit.pulls.get({owner: owner,
                                          repo: repo,
                                          pull_number: pull_number});
  let pr = response.data;

  // identifying user who edited the comment
  let user = payload.sender.login;

  // check if the user is a reviewer
  let reviewers = pr.requested_reviewers!.map(function (e) {return e!.login;})
  let auth = (reviewers.indexOf(user) > -1) || (user == 'checklist-demo[bot]');

  // reverting comment in case of unathorised access
  if (!auth) {
    await octokit.issues.updateComment({owner: owner,
                                        repo: repo,
                                        comment_id: payload.comment.id,
                                        body: payload.changes.body.from});
  }
  // input validation for authorised edits
  else if (user != 'checklist-demo[bot]') {
    let body_old = payload.changes.body.from.split(delimiter).slice(1, -1);
    let body_new = payload.comment.body.split(delimiter).slice(1, -1);

    let send_correction = false;
    for (let i = 0; i < body_new.length; i++) {
      let review_item = body_new[i].split(checkbox_separator);
      let checkboxes = review_item[1].split(nline);
      let checkbox_done = checkboxes[0];
      let checkbox_skip = checkboxes[1];

      let checkbox_done_checked = checkbox_done.slice(0, 4) === '- [x';
      let checkbox_skip_checked = checkbox_skip.slice(0, 4) === '- [x';

      if (checkbox_done_checked && checkbox_skip_checked) {
        send_correction = true;
        let review_item_old = body_old[i].split(checkbox_separator);
        let checkboxes_old = review_item_old[1].split(nline);
        let checkbox_done_old = checkboxes_old[0];
        let checkbox_skip_old = checkboxes_old[1];

        let checkbox_done_checked_old = checkbox_done_old.slice(0, 4) === '- [x';
        let checkbox_skip_checked_old = checkbox_skip_old.slice(0, 4) === '- [x';

        let corrected_checkboxes = '';
        if (checkbox_done_checked_old) {
          corrected_checkboxes = corrected_checkboxes.concat('- [ ] done', nline, checkbox_skip, nline);
        } else if (checkbox_skip_checked_old) {
          corrected_checkboxes = corrected_checkboxes.concat(checkbox_done, nline,
                                                            '- [ ] skipped; rationale : [enter text here]', nline);
        }

        body_new[i] = ''.concat(review_item[0], checkbox_separator, corrected_checkboxes);
      }
    }

    if (send_correction) {
      console.log('Sending Correction!');
      let updated_body = ''.concat(delimiter, body_new.join(delimiter), delimiter);

      await octokit.issues.updateComment({owner: owner,
                                          repo: repo,
                                          comment_id: payload.comment.id,
                                          body: updated_body});
    }
  }
}

async function statusCheck(octokit: Octokit, payload: any) {
  // proceed only in case of a PR and edit of bot's comment
  if (!payload.issue.pull_request ||
      !payload.comment.body.includes(delimiter)) {
    return;
  }
  const startTime = (new Date).toISOString();

  const owner: string = payload.repository.owner.login;
  const repo: string = payload.repository.name;
  const pull_number: number = payload.issue.number;

  // lookup the PR
  let response = await octokit.pulls.get({owner: owner, repo: repo, pull_number: pull_number});
  let pr = response.data;

  let comment_body = payload.comment.body.split(delimiter).slice(1, -1);
  let items_not_checked = 0;
  let skips_not_justified = 0;
  // check each review item
  for (let i = 0; i < comment_body.length; i++) {
    let review_item = comment_body[i].split(checkbox_separator);
    let checkboxes = review_item[1].split(nline);
    let checkbox_done = checkboxes[0];
    let checkbox_skip = checkboxes[1];

    let done_checked = checkbox_done.slice(0, 4) === '- [x';
    let skip_checked = checkbox_skip.slice(0, 4) === '- [x';

    // check if either of the statuses is checked for the review item
    if ((done_checked || skip_checked) && (!(done_checked && skip_checked))) {
      // if skip status is checked, check for justification tesxt
      if (skip_checked && checkbox_skip.includes('[enter text here]')) {
        skips_not_justified += 1;
      }
    } else {
      items_not_checked += 1;
    }
  }

  let status = (items_not_checked == 0 && skips_not_justified == 0) ? 'completed' : 'in_progress';
  let title = ''.concat((comment_body.length - items_not_checked - skips_not_justified)
                        + ' / ' + comment_body.length + ' review items completed');
  let summary = ''.concat(items_not_checked.toString(), ' review items not checked and ',
                          skips_not_justified.toString(), ' skips not justified');

  const endTime = (new Date).toISOString();

  let check = {
    owner: owner,
    repo: repo,
    name: 'checklist-demo',
    head_sha: pr.head.sha,
    started_at: startTime,
    status: status,
    output: {
      title: title,
      summary: summary,
      text: 'This bot checks for any incomplete review items from the review checklist.'
    },
    conclusion: 'action_required',
    completed_at: endTime,
    summary: '',
  };

  // all finished?
  if (status === 'completed') {
    check.conclusion = 'success';
    check.output.summary = 'All review items completed!';
  };

  // send check back to GitHub
  await octokit.checks.create(check);
}

export {validateUserInput, statusCheck, createChecklist};
