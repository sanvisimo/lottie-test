import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Duration } from "aws-cdk-lib"
import * as lambda from "aws-cdk-lib/aws-lambda"
import * as iam from "aws-cdk-lib/aws-iam"
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { NodejsFunction, NodejsFunctionProps } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as apigwv2  from 'aws-cdk-lib/aws-apigatewayv2';

const stage = process.env.STAGE !== "production" ? "-staging" : ""

export class LottieBeStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // The code that defines your stack goes here

    const chromeLayer = new lambda.LayerVersion(
        this,
        `chrome-layer${stage}`,
        {
          compatibleRuntimes: [lambda.Runtime.NODEJS_20_X],
          code: lambda.Code.fromAsset("chromium.zip"),
          description: "Chrome layer",
        }
    )

    const nodeJsFunctionProps: NodejsFunctionProps = {
      runtime: lambda.Runtime.NODEJS_20_X,
      memorySize: 1024,
      timeout: Duration.minutes(3),
      environment: {
        REGION: "eu-west-1",
      },
      bundling: {
        externalModules: [
          'aws-sdk'
        ],
        nodeModules: ["@sparticuz/chromium", "puppeteer-core", "puppeteer"],
      },
    }

    const mainLambda = new NodejsFunction(this, `LottieHandler${stage}`, {
      functionName: "screenshotFn",
      entry: "./lambda-fns/main.ts",
      ...nodeJsFunctionProps
    })

    const testLambda = new NodejsFunction(this, `TestHandler${stage}`, {
      entry: "./lambda-fns/testHandler.ts",
      ...nodeJsFunctionProps
    })

    const s3Policy = new iam.PolicyStatement({
      actions: ["s3:*"],
      resources: ["arn:aws:s3:::*"],
    })

    mainLambda.role?.attachInlinePolicy(
        new iam.Policy(this, `s3-policy${stage}`, {
          statements: [s3Policy],
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

    const lottieLambdaIntegration = new HttpLambdaIntegration('LottieIntegration', mainLambda);
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
