# Serverless URL Shortener Backend

Use the AWS CDK to quickly deploy an S3 backed redirection machine. Use the UI or the lambda url to add and remove redirects.

To create your own URL shortening service in S3 simply clone the repo and use the commands:

`npm i`

`cdk deploy -c SUB=admin -c URL=yoururl.tld -c KEY=yourpasskey`

Then configure your DNS records using the output from the deployment. Once configured go to SUB.URL to manage redirects from the UI.

Changing your managment URL, SUB domain, or KEY is as easy as running the command again with the parameter(s) you wish to change:

`cdk deploy -c SUB=newsub -c URL=new.URL -c KEY=newpasskey`

To run this deployment without the UI you can supply the CORSurl context variable to only allow traffic from your app's URL, you can use PUT and DELETE requests to the created function URL to create or delete redirects. The function URL takes a payload body like: {"redirectTo":URL} or {"redirectFrom":code} for PUT and DELETE requests respectively. In this mode a KEY is not required to edit redirects so your function URL is a secret.

`cdk deploy -c CORSurl=myapp.tld -c URL=yoururl.tld`

You can also provide an ARN of a lambda URL, or IAM user, group, or role to setup IAM authentication with your lambda URL

`cdk deploy -c IAM=arn:aws:... -c URL=yoururl.tld`

Thinking of adding authorized apigw to replace lambda+URL.
