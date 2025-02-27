const updateJSON = require('./update.json');
var exec = require('child-process-promise').exec
const simpleGit = require("simple-git");
const debug = require('debug');
require('dotenv').config()

const branch = 'env/svil';
const createLibUpdateBranch = true;
const mergeInBranch = true;
const buildLocals = false;
const repos = [
    'npc-deploy-arch',
    'xdce-module-fcj-common-widget',
    'xdce-module-fcj-accounts-v1',
    'xdce-module-fcj-confirming-v1',
    'xdce-module-fcj-contracts-v1',
    'xdce-module-fcj-dashboard-v1',
    'xdce-module-fcj-transfers-v1',
    'deploy/npc-deploy-fcj-accounts-v1',
    'deploy/npc-deploy-fcj-confirming-v1',
    'deploy/npc-deploy-fcj-contracts-v1',
    'deploy/npc-deploy-fcj-dashboard-v1',
    'deploy/npc-deploy-fcj-transfers-v1',
]

// current date dd-mm
const date = new Date();
const day = date.getDate();
let month = date.getMonth() + 1;
if (month < 10) {
    month = `0${month}`;
} else {
    month = `${month}`;
}
const strDate = `${day}${month}`;

debug.enable('simple-git');

(async function init() {

    // Iterate each repo
    for (let repo of repos) {
        let isGitRepo = true;
        const git = simpleGit(`../${repo}`);
        const updatePackageJSON = function () {

            // Read the package.json file
            var packageJSON = require(`../${repo}/package.json`);

            // update the keys in the package.json file with the values from the update.json file
            for (var key in updateJSON) {
                if (packageJSON.dependencies[key]) {
                    packageJSON.dependencies[key] = updateJSON[key];
                } else if (packageJSON.devDependencies[key]) {
                    packageJSON.devDependencies[key] = updateJSON[key];
                }
            }

            // Write the updated package.json file
            const fs = require('fs');
            fs.writeFile(`../${repo}/package.json`, JSON.stringify(packageJSON, null, 2), (err) => {
                if (err) throw err;
                console.log(`The file ${repo}/package.json has been updated!`);
            });

        }


        // get git status
        try {
            const status = await git.status();


            // If there are changes, stash them
            if (status.files.length > 0) {
                await git.stash('pre-update', 'Stashing changes before updating the package.json file');
            }

            // Checkout the branch
            await git.checkout(branch);

            // Pull the branch
            await git.pull();

            // Create a new branch if createLibUpdateBranch is true
            if (createLibUpdateBranch) {
                try {
                    // Try to checkout the branch if possible
                    await git.checkout(`lib-update-${strDate}`);
                } catch (e) {
                    // If the branch does not exist, create it
                    await git.checkoutLocalBranch(`lib-update-${strDate}`);
                }
            }

            updatePackageJSON();

            // get git status again
            const status2 = await git.status();

            // If there are changes, stash them
            if (status2.files.length > 0) {
                await git.add('./*');
                await git.commit('Update package.json file with latest versions');
            } else {
                console.log('No changes to commit');
            }

            if (mergeInBranch) {
                await git.checkout(branch);
                await git.pull();

                // merge from master to the branch
                console.log(await git.mergeFromTo('origin/master', branch));

                // merge from the lib-update branch to the branch
                console.log(await git.merge([`lib-update-${strDate}`]));
            }

        } catch (e) {
            updatePackageJSON();
        }
    }

    if (buildLocals) {
        // run npm install on parent folder of current script folder
        await exec(`npm install`, { cwd: `../` });

        // for each repo, run npm run build:dev
        for (let repo of repos) {
            await exec(`npm run build:dev`, { cwd: `../${repo}` });
        }
    }
})()
