# Serverless URL Shortener Backend

Use the AWS CDK to quickly deploy an S3 backed redirection machine. Use the UI or the lambda url to add and remove redirects.

To create your own URL shortening service in S3 simply clone the repo and use the commands:

`npm i`

`cdk deploy --parameters SUB=admin --parameters URL=yoururl.tld --parameters KEY=yourpasskey`

Then configure your DNS records using the output from the deployment.

Changing your managment URL, SUB domain, or KEY is as easy as running the command again with the parameter(s) you wish to change:

`cdk deploy --parameters SUB=newsub --parameters URL=new.URL --parameters KEY=newpasskey`

You can use the UI or PUT and DELETE requests to the created function URL to create or delete redirects. The function URL takes a payload body like: {"redirectTo":URL,"key":""} or {"redirectFrom":code,"key":""} for PUT and DELETE requests respectively.

Thinking of adding authorized apigw to replace lambda.
