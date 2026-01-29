# fixhub
enhance the github experience

adds 3 primary features:
- hide the assignee column
- show author profile pic
- show reviewers avatar with a status border
    - green = approved, yellow = comment

there is an input for a github token, since it's necessary to make an api request to github to find the reviewers. the limit is 60/hr with no token so you'll hit it pretty fast. there is some basic caching. i'd recommend putting the most limited scoped token, only read only on PRs. 


run `./build.sh` to output a zip file, you can load that file into chrome if you have developer mode enabled