import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Duration, Size } from "aws-cdk-lib"
import * as lambda from "aws-cdk-lib/aws-lambda"
import * as iam from "aws-cdk-lib/aws-iam"
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { NodejsFunction, NodejsFunctionProps } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as apigwv2  from 'aws-cdk-lib/aws-apigatewayv2';
import * as s3 from 'aws-cdk-lib/aws-s3';

const stage = process.env.STAGE !== "production" ? "-staging" : ""

export class LottieBeStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // The code that defines your stack goes here

    const bucket = new s3.Bucket(this, 'LottieBucket', {
      bucketName: 'lottie-bucket',
      blockPublicAccess: {
        blockPublicAcls: false,
        blockPublicPolicy: false,
        ignorePublicAcls: false,
        restrictPublicBuckets: false,
      },
      publicReadAccess: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });

    const chromeLayer = new lambda.LayerVersion(
        this,
        `chrome-layer${stage}`,
        {
          compatibleRuntimes: [lambda.Runtime.NODEJS_20_X],
          code: lambda.Code.fromAsset("chromium.zip"),
          description: "Chrome layer",
        }
    )

    const ffmpegLayer = new lambda.LayerVersion(
        this,
        `ffmpeg-layer${stage}`,
        {
          compatibleRuntimes: [lambda.Runtime.NODEJS_20_X],
          code: lambda.Code.fromAsset("ffmpeg.zip"),
          description: "FFMPEG layer",
        }
    )

    const nodeJsFunctionProps: NodejsFunctionProps = {
      runtime: lambda.Runtime.NODEJS_20_X,
      memorySize: 3008,
      timeout: Duration.minutes(15),
      layers: [chromeLayer, ffmpegLayer],
      environment: {
        REGION: "eu-west-1",
      },
      bundling: {
        externalModules: [
          'aws-sdk'
        ],
        nodeModules: [
          "@sparticuz/chromium",
          "lottie-web"
        ],
      },
    }

    const mainLambda = new NodejsFunction(this, `LottieHandler${stage}`, {
      functionName: "screenshotFn",
      entry: "./lambda-fns/main.ts",
      ephemeralStorageSize:  Size.mebibytes(1024),
      ...nodeJsFunctionProps
    })

    const testLambda = new NodejsFunction(this, `TestHandler${stage}`, {
      entry: "./lambda-fns/testHandler.ts",
      ...nodeJsFunctionProps
    })

    const callLambda = new NodejsFunction(this, `CallHandler${stage}`, {
      functionName: "callHandler",
      entry: "./lambda-fns/callHandler.ts",
      ...nodeJsFunctionProps
    })

    const s3Policy = new iam.PolicyStatement({
      actions: ["s3:*"],
      resources: [bucket.arnForObjects('*')]
    })

    mainLambda.role?.attachInlinePolicy(
        new iam.Policy(this, `s3-policy${stage}`, {
          statements: [s3Policy],
        })
    )

    const invokePolicy = new iam.PolicyStatement({
      actions: ["lambda:*"],
      resources: [mainLambda.functionArn]
    })

    callLambda.role?.attachInlinePolicy(
        new iam.Policy(this, `invoke-policy${stage}`, {
          statements: [invokePolicy],
        })
    )

    const httpApi =  new apigwv2.HttpApi(this, 'LottieApi', {
      apiName: "LottieApi",
      description: 'HTTP API example',
      corsPreflight: {
        allowHeaders: [
          'Content-Type',
          'X-Amz-Date',
          'Authorization',
          'X-Api-Key',
        ],
        allowMethods: [
          apigwv2.CorsHttpMethod.OPTIONS,
          apigwv2.CorsHttpMethod.GET,
          apigwv2.CorsHttpMethod.POST,
          apigwv2.CorsHttpMethod.PUT,
          apigwv2.CorsHttpMethod.PATCH,
          apigwv2.CorsHttpMethod.DELETE,
        ],
        allowCredentials: true,
        allowOrigins: ['http://localhost:3000'],
      },
    });

    const lottieLambdaIntegration = new HttpLambdaIntegration('LottieIntegration', callLambda);
    const lottieTestLambdaIntegration = new HttpLambdaIntegration('LottieTestIntegration', testLambda);

    httpApi.addRoutes({
      path: '/lottie',
      methods: [ apigwv2.HttpMethod.POST],
      integration: lottieLambdaIntegration,
    })

    httpApi.addRoutes({
      path: '/lottie',
      methods: [ apigwv2.HttpMethod.GET],
      integration: lottieTestLambdaIntegration,
    })

    new cdk.CfnOutput(this, "apiEndpoint", {
      value: httpApi.apiEndpoint,
    });
  }
}
