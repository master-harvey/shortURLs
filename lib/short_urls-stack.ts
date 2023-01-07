import {
  Stack, StackProps, RemovalPolicy, pipelines,
  aws_certificatemanager as cm, aws_iam as iam,
  aws_codebuild as cbd, aws_codepipeline_actions as cpa,
  aws_s3 as s3, aws_lambda as lambda, aws_cloudfront as cf,
  aws_codepipeline as codepipeline, aws_secretsmanager as sm,
  aws_route53 as r53,
  CfnOutput,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';

export class ShortUrlsStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);
    //  Check URL context
    if (this.node.tryGetContext('URL') == "") {
      throw ("You did not supply the URL context variable, add it using the -c URL=your.URL CLI syntax")
    } else if (this.node.tryGetContext('URL').length < 4 || !this.node.tryGetContext('URL').includes('.')) {
      throw ("The URL context variable must be of the form yourURL.tld")
    }
    //  Check passkey context
    if (this.node.tryGetContext('KEY') == "") {
      throw ("You did not supply the KEY context variable, add it using the -c KEY=yourpasskey CLI syntax")
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
        commands: ['npm ci', 'npm run build', `npx cdk synth -c URL=${this.node.tryGetContext("URL")} -c KEY=${this.node.tryGetContext("KEY")}`]
      }),
    })

    //S3 Deployment Bucket
    const sourceBucket = new s3.Bucket(this, 'Bucket', {
      bucketName: `shorturls--ui-deployment`,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      websiteIndexDocument: "index.html",
      publicReadAccess: true
    });

    //Lambda IAM policy & role
    const lambdaServicePrincipal = new iam.ServicePrincipal("lambda.amazonaws.com")
    const role = new iam.Role(this, "manageRedirects", {
      roleName: "shortURLs-manager-role", assumedBy: lambdaServicePrincipal,
      inlinePolicies: {
        "redirect-manager": new iam.PolicyDocument({
          statements: [new iam.PolicyStatement({
            actions: ['s3:PutObject', 's3:DeleteObject'],
            resources: [sourceBucket.bucketArn],
          })],
        })
      }
    })

    //Lambda w/ function URL
    const lamb = new lambda.Function(this, 'Function', {
      functionName: "shortURLs-manager",
      code: lambda.Code.fromAsset('./lambda'),
      runtime: lambda.Runtime.PYTHON_3_9, role,
      handler: 'main.handler', environment: { "BUCKET": sourceBucket.bucketName, "KEY": this.node.tryGetContext("KEY") },
    });
    const funcURL = lamb.addFunctionUrl({
      // cors: { //test without cors
      //   allowedOrigins: [`https://${this.node.tryGetContext('URL')}`],
      //   allowedMethods: [lambda.HttpMethod.PUT, lambda.HttpMethod.DELETE]
      // }
    })

    //Cloudfront + Cert
    const zone = new r53.HostedZone(this, "HostedZone", { zoneName: this.node.tryGetContext('URL') })
    const cert = new cm.Certificate(this, "UI-Cert", {
      domainName: this.node.tryGetContext('URL'),
      certificateName: 'shortURLs-UI',
      validation: cm.CertificateValidation.fromDns(zone)
    })
    const distribution = new cf.CloudFrontWebDistribution(this, 'Distribution', {
      viewerCertificate: {
        aliases: [this.node.tryGetContext('URL')],
        props: {
          acmCertificateArn: cert.certificateArn,
          sslSupportMethod: 'sni-only',
          minimumProtocolVersion: 'TLSv1.1_2016'
        }
      },
      originConfigs: [
        {
          s3OriginSource: { s3BucketSource: sourceBucket },
          behaviors: [{ isDefaultBehavior: true }],
        },
      ],
    })


    /*  -- Begin UI Deployment Pipeline --  */
    const artifacts = new s3.Bucket(this, "ArtifactBucket", {
      bucketName: `shorturls--ui-artifacts`,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true
    })

    const cPipeline = new codepipeline.Pipeline(this, "DeploymentPipeline", {
      pipelineName: `shortURLs--UI-Deployment-Pipeline`,
      crossAccountKeys: false,
      artifactBucket: artifacts
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
      bucket: sourceBucket,
      input: builtCode
    }))

    // Create the build project that will invalidate the cache | https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_codepipeline_actions.CodeBuildActionProps.html
    // const invalidateBuildProject = new cbd.PipelineProject(this, `InvalidateProject`, {
    //   projectName: `shortURLs--Invalidate-Dist`,
    //   environment: { buildImage: cbd.LinuxBuildImage.STANDARD_5_0 },
    //   buildSpec: cbd.BuildSpec.fromObject({
    //     version: '0.2',
    //     phases: {
    //       build: {
    //         commands: [`aws cloudfront create-invalidation --distribution-id ${distribution.distributionId} --paths "/assets"`], //invalidate just the ui files?
    //       },
    //     },
    //   })
    // });

    // // invalidate cloudfront cache for 'immediate' redeployment
    // const invalidateStage = cPipeline.addStage({ stageName: "Invalidate-CF-Cache" })
    // invalidateStage.addAction(new cpa.CodeBuildAction({
    //   actionName: 'InvalidateCache',
    //   project: invalidateBuildProject,
    //   input: builtCode
    // }))
    /*  -- Finish Pipeline --  */

    new CfnOutput(this, "Distribution/Alias URL", { value: distribution.distributionDomainName })
    new CfnOutput(this, "ValidationRecord", { value: "Check the route53 console UI for your DNS validation records" })
    new CfnOutput(this, "URLcontext", { value: this.node.tryGetContext('URL') })
    new CfnOutput(this, "KEYcontext", { value: this.node.tryGetContext('KEY') })
  }
}
