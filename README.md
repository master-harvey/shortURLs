# Serverless URL Shortener Backend

Use the AWS CDK to quickly deploy an S3 backed redirection machine. Use the UI or the lambda url to add and remove redirects.

To create your own URL shortening service in S3 simply clone the repo and use the commands:

`npm i`

`cdk deploy --parameter URL=your.URL --parameter KEY=yourpasskey`

Then configure your DNS records using the output from the deployment.

Thinking of adding authorized apigw to replace lambda+URL, frontend ui, etc
