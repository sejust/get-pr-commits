const fs = require('fs')
const core = require('@actions/core')
const github = require('@actions/github')

const validEvent = ['pull_request', 'merge_group']

async function main() {
  try {
    const { eventName, payload: {repository: repo, pull_request: pr} } = github.context

    if (validEvent.indexOf(eventName) < 0) {
      core.error(`Invalid event: ${eventName}`)
      return
    }

    const outfile = core.getInput('output-file')
    const token = core.getInput('token')
    const filterOutPattern = core.getInput('filter_out_pattern')
    const filterOutFlags = core.getInput('filter_out_flags')
    const octokit = new github.GitHub(token)

    let page = 1
    let commits = []
    while (true) {
      const response = await octokit.pulls.listCommits({
        owner: repo.owner.login,
        repo: repo.name,
        pull_number: pr.number,
        per_page: 100,
        page: page
      })

      console.log(`Got ${response.data.length} commits at page ${page}`)
      commits = commits.concat(response.data)

      // has next?
      const linkHeader = response.headers.link
      if (!linkHeader || !linkHeader.includes('rel="next"')) {
        break
      }
      page++
    }

    if (filterOutPattern) {
      const regex = new RegExp(filterOutPattern, filterOutFlags)
      commits = commits.filter(({commit}) => {
        return !regex.test(commit.message)
      })
    }

    const jsondata = JSON.stringify(commits)

    core.setOutput('commits', jsondata)

    if (outfile) {
      fs.writeFileSync(outfile, jsondata)
      console.log(`save json data to file:${outfile}.`)
    }
  } catch (error) {
    core.setFailed(error.message)
  }
}

main()
