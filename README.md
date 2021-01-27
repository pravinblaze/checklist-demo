# Checklist Demo

### This GitHub app does the following things:
* When a pull request is raised, a new comment is created with a review checklist based on files in the pull request.
* Only allows reviewers to interact with the review checklist.
* Blocks the pull request from merging until all review items are addressed.

### To run this application
* Create .env file with appropriate values based on example.env template.
* Install necessary dependencies from packages.json / package-lock.json.
* Run commands:
	* `npx tsc`
	* `npm start`
