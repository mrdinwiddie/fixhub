# fixhub
enhance the github experience

adds 3 primary features:
- hide the assignee column
- show author profile pic
- show reviewers avatar with a status border
    - green = approved 
    - yellow = comment or stale review
    - red = changes requested
    - grey = assigned /w no interactions

there is an input for a github token, since it's necessary to make an api request to github to find the reviewers. the limit is 60/hr with no token so you'll hit it pretty fast. there is some basic caching. i'd recommend putting the most limited scoped token, only read only on PRs. 

there is now a scraping option to bypass the need for a key (you have to be authenticated)

you likely only need to clone and add the directory as an unpacked extension.
run `./build.sh` to output a zip file, you can load that file into chrome if you have developer mode enabled


the extension is pending approval on the chrome web store.

there is no data collection or communication with external services (asside from the github api obviouosly)