import {
  Stack, StackProps, RemovalPolicy, pipelines,
  aws_certificatemanager as cm, aws_iam as iam,
  aws_codebuild as cbd, aws_codepipeline_actions as cpa,
  aws_s3 as s3, aws_lambda as lambda, aws_cloudfront as cf,
  aws_codepipeline as codepipeline, aws_secretsmanager as sm,
  aws_route53 as r53, aws_s3_deployment as s3d,
  CfnOutput, CfnParameter
} from 'aws-cdk-lib';
import { Construct } from 'constructs';

export class ShortUrlsStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const URL = new CfnParameter(this, "URL", {
      description: "The short URL", type: "String"
    });
    //  Check URL params
    if (URL.valueAsString == "") {
      throw ("You did not supply the URL parameter, add it using the --parameters URL=your.URL CLI syntax")
    } else if (URL.valueAsString.length < 4 || !URL.valueAsString.includes('.')) {
      throw ("The URL parameter must be of the form yourURL.tld")
    }

    if (!this.node.tryGetContext('CORSurl')) {
      const SUB = new CfnParameter(this, "SUB", {
        description: "The SUBdomain used to manage short URLs", type: "String"
      });
      const KEY = new CfnParameter(this, "KEY", {
        description: "The KEY used to manage redirects", type: "String"
      });
      //  Check passkey param
      if (KEY.valueAsString == "") {
        throw ("You did not supply the KEY parameter, add it using the --parameters KEY=yourpasskey CLI syntax")
      }
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
        commands: ['npm ci', 'npm run build', `npx cdk synth -c CORSurl=${this.node.tryGetContext('CORSurl') ?? ""}`]
      }),
    })

    //Website bucket serving redirects and 'blank' index.html
    const redirectBucket = new s3.Bucket(this, 'Bucket', {
      bucketName: URL.valueAsString,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      websiteIndexDocument: "index.html",
      publicReadAccess: true
    });

    //put index.html in the redirect bucket
    new s3d.BucketDeployment(this, 'DeployFiles', { sources: [s3d.Source.asset('./src')], destinationBucket: redirectBucket });

    //Lambda w/ function URL
    const lamb = new lambda.Function(this, 'Function', {
      functionName: "shortURLs-manager",
      handler: 'main.handler', environment: { "BUCKET": redirectBucket.bucketName, "KEY": KEY.valueAsString },
      code: lambda.Code.fromAsset('./lambda'),
      runtime: lambda.Runtime.PYTHON_3_9,
      role: new iam.Role(this, "manageRedirects", {
        roleName: "shortURLs-manager-role", assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
        managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole")],
        inlinePolicies: {
          "redirect-manager": new iam.PolicyDocument({
            statements: [new iam.PolicyStatement({
              actions: ['s3:PutObject', 's3:DeleteObject'],
              resources: [redirectBucket.bucketArn, `${redirectBucket.bucketArn}/*`],
            })],
          })
        }
      })
    });

    const funcURL = lamb.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE, //Internal key validation
      cors: { //test without cors
        allowedOrigins: [this.node.tryGetContext('CORSurl') ?? `https://${SUB.valueAsString}.${URL.valueAsString}`],
        allowedMethods: [lambda.HttpMethod.PUT, lambda.HttpMethod.DELETE]
      }
    })

    if (!this.node.tryGetContext('CORSurl')) {
      // Management UI bucket
      const UIbucket = new s3.Bucket(this, "UIBucket", {
        bucketName: `shorturls--ui`,
        removalPolicy: RemovalPolicy.DESTROY,
        autoDeleteObjects: true,
        websiteIndexDocument: 'index.html',
        publicReadAccess: true
      })

      //Cloudfront + Cert for Management UI
      // const zone = new r53.HostedZone(this, "HostedZone", { zoneName: `${SUB.valueAsString}.${URL.valueAsString}` })
      // const cert = new cm.Certificate(this, "UI-Cert", {
      //   domainName: URL.valueAsString,
      //   certificateName: 'shortURLs-UI',
      //   validation: cm.CertificateValidation.fromDns(zone)
      // })
      const distribution = new cf.CloudFrontWebDistribution(this, 'Distribution', {
        // viewerCertificate: {
        //   aliases: [`${SUB.valueAsString}.${URL.valueAsString}`],
        //   props: {
        //     acmCertificateArn: cert.certificateArn,
        //     sslSupportMethod: 'sni-only',
        //     minimumProtocolVersion: 'TLSv1.1_2016'
        //   }
        // },
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
        environment: { buildImage: cbd.LinuxBuildImage.STANDARD_5_0 },
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
      new CfnOutput(this, "DistributionDomain", { value: `Create an alias alias record for ${SUB.valueAsString}.${URL.valueAsString} to: ${distribution.distributionDomainName}` })
      new CfnOutput(this, "KEYparam", { value: `Your management KEY is: ${KEY.valueAsString}` })
      new CfnOutput(this, "URLparam", { value: `Your management URL is: ${SUB.valueAsString}.${URL.valueAsString}` })
    }

    new CfnOutput(this, "BucketDomain", { value: `Create an alias record for ${URL.valueAsString} to: ${redirectBucket.bucketWebsiteDomainName}` })
    new CfnOutput(this, "FunctionURL", { value: `Manage short URLs using this endpoint: ${funcURL.url}` }) // remove in production and enable CORS
    // new CfnOutput(this, "Validation", { value: `Get your CNAME validation record from the deployment output or from: https://us-east-1.console.aws.amazon.com/route53/v2/hostedzones#ListRecordSets/${zone.hostedZoneId}` })
  }
}
