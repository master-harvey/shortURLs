import {
  Stack, StackProps, RemovalPolicy, pipelines,
  aws_certificatemanager as cm, aws_iam as iam,
  aws_codebuild as cbd, aws_codepipeline_actions as cpa,
  aws_s3 as s3, aws_lambda as lambda, aws_cloudfront as cf,
  aws_codepipeline as codepipeline, aws_secretsmanager as sm,
  aws_route53 as r53, aws_s3_deployment as s3d,
  CfnOutput
} from 'aws-cdk-lib';
import { Construct } from 'constructs';

export class ShortUrlsStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const URL: string = this.node.tryGetContext('URL')
    const SUB: string = this.node.tryGetContext('SUB') ?? ""
    const KEY: string = this.node.tryGetContext('KEY') ?? ""
    const CORS: string = this.node.tryGetContext('CORSurl') ?? ""
    const IAM: string = this.node.tryGetContext('IAM') ?? ""

    //  Check URL context
    if (!URL) { throw ("You did not supply the URL context variable, add it using the -c URL=your.URL CLI syntax") }
    if (URL.length < 4 || !URL.includes('.')) { throw ("The URL parameter must be of the form yourURL.tld") }

    if (!CORS && !IAM && !SUB) { throw ("You must specify either the arn with permissions to invoke this URL using -c IAM=, an origin to accept traffic from using -c CORSurl=, or a SUBdomain and passKEY using -c SUB= -c KEY=") }

    if (SUB) {
      if (!KEY) { throw ("The UI requires the KEY context variable, add it using the -c KEY=yourpasskey CLI syntax") }
      console.log("CORSurl context variable not supplied, building UI")
    }

    //  CDK pipeline for this deployment
    const iPipeline = new pipelines.CodePipeline(this, 'Pipeline', {
      pipelineName: "shortURLs--CDK-Pipeline",
      crossAccountKeys: false,
      dockerEnabledForSelfMutation: true,
      dockerEnabledForSynth: true,
      synth: new pipelines.ShellStep('Synth', {
        input: pipelines.CodePipelineSource.gitHub('master-harvey/shortURLs', 'Infrastructure'),
        installCommands: ['npm i -g npm@latest'],
        commands: ['npm ci', 'npm run build', `npx cdk synth -c URL=${URL} -c CORSurl=${CORS} -c SUB=${SUB} -c KEY=${KEY} -c IAM=${IAM}`]
      }),
    })

    //Website bucket serving redirects and 'blank' index.html
    const redirectBucket = new s3.Bucket(this, 'Bucket', {
      bucketName: URL,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      websiteIndexDocument: "index.html",
      publicReadAccess: true
    });

    //put index.html in the redirect bucket
    new s3d.BucketDeployment(this, 'DeployFiles', { sources: [s3d.Source.asset('./src')], destinationBucket: redirectBucket });

    //Lambda w/ function URL
    const functionName = "shortURLs-manager"
    const lambdaRole = new iam.Role(this, "manageRedirects", {
      roleName: "shortURLs-manager-role", assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole")],
      inlinePolicies: {
        "redirect-manager": new iam.PolicyDocument({
          statements: [new iam.PolicyStatement({
            actions: ['s3:PutObject', 's3:DeleteObject'],
            resources: [redirectBucket.bucketArn, `${redirectBucket.bucketArn}/*`]
          })],
        })
      }
    })
    if (IAM) {
      lambdaRole.attachInlinePolicy(new iam.Policy(this, "IAMauth", {
        document: new iam.PolicyDocument({
          statements: [new iam.PolicyStatement({
            actions: ['lambda:InvokeFunctionURL'],
            resources: [IAM]
          })]
        })
      }))
    }

    const lamb = new lambda.Function(this, 'Function', {
      handler: 'main.handler', environment: { "BUCKET": redirectBucket.bucketName, "KEY": KEY },
      functionName, code: lambda.Code.fromAsset('./lambda'), runtime: lambda.Runtime.PYTHON_3_9,
      role: lambdaRole
    });

    const funcURL = lamb.addFunctionUrl({
      authType: IAM ? lambda.FunctionUrlAuthType.AWS_IAM : lambda.FunctionUrlAuthType.NONE, //CORS & Internal KEY validation if IAM arn isn't supplied
      cors: (!SUB && !CORS) ? undefined : { // blank CORS config for IAM and headless usage
        allowedOrigins: [CORS, SUB ? `https://${SUB}.${URL}` : ''].filter(i => i.length > 0),
        allowedMethods: [lambda.HttpMethod.PUT, lambda.HttpMethod.DELETE],
        allowedHeaders: ["application/json"]
      }
    })

    if (SUB) { //build the UI if the subdomain is supplied
      // Management UI bucket
      const UIbucket = new s3.Bucket(this, "UIBucket", {
        bucketName: `shorturls--ui`,
        removalPolicy: RemovalPolicy.DESTROY,
        autoDeleteObjects: true,
        websiteIndexDocument: 'index.html',
        publicReadAccess: true
      })

      //Cloudfront + Cert for Management UI
      const zone = new r53.HostedZone(this, "HostedZone", { zoneName: `${SUB}.${URL}` })
      const cert = new cm.Certificate(this, "UI-Cert", {
        domainName: URL,
        certificateName: 'shortURLs-UI',
        validation: cm.CertificateValidation.fromDns(zone)
      })
      const distribution = new cf.CloudFrontWebDistribution(this, 'Distribution', {
        viewerCertificate: {
          aliases: [`${SUB}.${URL}`],
          props: {
            acmCertificateArn: cert.certificateArn,
            sslSupportMethod: 'sni-only',
            minimumProtocolVersion: 'TLSv1.1_2016'
          }
        },
        originConfigs: [
          {
            s3OriginSource: { s3BucketSource: UIbucket },
            behaviors: [{ isDefaultBehavior: true }],
          },
        ],
      })

      /*  -- Begin UI Deployment Pipeline --  */
      const cPipeline = new codepipeline.Pipeline(this, "DeploymentPipeline", {
        pipelineName: `shortURLs--UI-Deployment-Pipeline`,
        crossAccountKeys: false,
        artifactBucket: UIbucket
      })

      const sourceStage = cPipeline.addStage({ stageName: "Source" })
      const sourceCode = new codepipeline.Artifact()
      const token = sm.Secret.fromSecretNameV2(this, 'githubToken', 'github-token')
      const gitSource = new cpa.GitHubSourceAction({
        oauthToken: token.secretValue,
        actionName: "shortURLs--Pull-Source",
        owner: "master-harvey",
        repo: "shortURLs",
        branch: "Interface",
        output: sourceCode,
        trigger: cpa.GitHubTrigger.WEBHOOK
      })
      sourceStage.addAction(gitSource)

      const buildStage = cPipeline.addStage({ stageName: "Build" })
      const buildProject = new cbd.PipelineProject(this, "shortURLs-UI--Build-Project", {
        projectName: `shortURLs--UI-Builder`,
        environment: {
          buildImage: cbd.LinuxBuildImage.STANDARD_5_0,
          environmentVariables: { functionURL: { value: funcURL.url } }
        },
        concurrentBuildLimit: 1
      })

      const builtCode = new codepipeline.Artifact()
      buildStage.addAction(new cpa.CodeBuildAction({
        actionName: "shortURLs-UI--Build-Source",
        project: buildProject,
        input: sourceCode,
        outputs: [builtCode]
      }))

      //const testStage = cPipeline.addStage({ stageName: "Test" })

      const deployStage = cPipeline.addStage({ stageName: "Deploy" })
      deployStage.addAction(new cpa.S3DeployAction({
        actionName: 'shortURLs-S3Deploy',
        bucket: UIbucket,
        input: builtCode
      }))
      /*  -- Finish Pipeline --  */
      new CfnOutput(this, "DistributionDomain", { value: `Create an alias alias record for ${SUB}.${URL} to: ${distribution.distributionDomainName}` })
      new CfnOutput(this, "Validation", { value: `Get your CNAME validation record from the deployment output or from: https://us-east-1.console.aws.amazon.com/route53/v2/hostedzones#ListRecordSets/${zone.hostedZoneId}` })
      new CfnOutput(this, "KEY", { value: `[SECRET] Your management KEY is: ${KEY}` })
      new CfnOutput(this, "SUB", { value: `[SECRET] Your management URL is: ${SUB}.${URL}` })
    }

    if (IAM) { new CfnOutput(this, "IAM", { value: `Access to your function URL has been granted to the ARN: ${IAM}` }) }
    if (CORS) { new CfnOutput(this, "CORSurl", { value: `[SECRET] CORS header allows traffic rom this endpoint: ${CORS}` }) }
    new CfnOutput(this, "URL", { value: `Your short URL is: ${URL}` })
    new CfnOutput(this, "BucketDomain", { value: `Create an alias record for ${URL} to: ${redirectBucket.bucketWebsiteDomainName}` })
    new CfnOutput(this, "FunctionURL", { value: `${!SUB ? "[SECRET] " : ""}Manage short URLs using this endpoint: ${funcURL.url}` })
  }
}
