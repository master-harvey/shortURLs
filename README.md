# Serverless URL Shortener Backend

Use the AWS CDK to quickly deploy an S3 backed redirection machine. Use the UI or the lambda url to add and remove redirects.

To create your own URL shortening service in S3 simply clone the repo and use the commands:

`npm i`

`cdk deploy --parameters URL=your.URL --parameters KEY=yourpasskey`

Then configure your DNS records using the output from the deployment.

Changing your managment URL or KEY is as easy as running the command again with the parameter(s) you wish to change:

`cdk deploy --parameters URL=new.URL --parameters KEY=yournewpasskey`

Thinking of adding authorized apigw to replace lambda+URL, frontend ui, etc
