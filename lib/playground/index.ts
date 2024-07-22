import { Construct } from "constructs";
import {
  ExecSyncOptionsWithBufferEncoding,
  execSync,
} from "node:child_process";
import { Utils } from "../uitls";
import { WebSocketLambdaAuthorizer } from "aws-cdk-lib/aws-apigatewayv2-authorizers";
import { WebSocketLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import { StackConfig } from "../types";
import * as path from "node:path";
import * as cdk from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as cf from "aws-cdk-lib/aws-cloudfront";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as cognitoIdentityPool from "@aws-cdk/aws-cognito-identitypool-alpha";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as lambdaPython from "@aws-cdk/aws-lambda-python-alpha";
import * as logs from "aws-cdk-lib/aws-logs";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import * as iam from "aws-cdk-lib/aws-iam";

export interface PlaygroundProps {
  config: StackConfig;
  bedrockRegion: string;
  bedrockModel: string;
  lambdaArchitecture: lambda.Architecture;
  powerToolsLayer: lambda.ILayerVersion;
  codeInterpreterTool?: lambda.IFunction;
  webSearchTool?: lambda.IFunction;
}

export class Playground extends Construct {
  readonly userPool: cognito.IUserPool;
  readonly distribution: cf.CloudFrontWebDistribution;

  constructor(scope: Construct, id: string, props: PlaygroundProps) {
    super(scope, id);

    const appPath = path.join(__dirname, "user-interface");
    const buildPath = path.join(appPath, "dist");

    const websiteBucket = new s3.Bucket(this, "WebsiteBucket", {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      autoDeleteObjects: true,
      websiteIndexDocument: "index.html",
      websiteErrorDocument: "index.html",
    });

    const sessionBucket = new s3.Bucket(this, "SessionBucket", {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      autoDeleteObjects: true,
    });

    const uploadBucket = new s3.Bucket(this, "UploadBucket", {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      autoDeleteObjects: true,
      transferAcceleration: true,
      cors: [
        {
          allowedHeaders: ["*"],
          allowedMethods: [
            s3.HttpMethods.PUT,
            s3.HttpMethods.POST,
            s3.HttpMethods.GET,
            s3.HttpMethods.HEAD,
          ],
          allowedOrigins: ["*"],
          exposedHeaders: ["ETag"],
          maxAge: 3000,
        },
      ],
    });

    const originAccessIdentity = new cf.OriginAccessIdentity(this, "S3OAI");
    websiteBucket.grantRead(originAccessIdentity);

    const sessionTable = new dynamodb.Table(this, "SessionTable", {
      partitionKey: {
        name: "userId",
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: { name: "sessionId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    sessionTable.addGlobalSecondaryIndex({
      indexName: "byEntityId",
      partitionKey: { name: "userId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "entityId", type: dynamodb.AttributeType.STRING },
    });

    const userPool = new cognito.UserPool(this, "UserPool", {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      selfSignUpEnabled: false,
      autoVerify: { email: true, phone: true },
      signInAliases: {
        email: true,
      },
    });

    const userPoolClient = userPool.addClient("UserPoolClient", {
      generateSecret: false,
      authFlows: {
        adminUserPassword: true,
        userPassword: true,
        userSrp: true,
      },
    });

    const identityPool = new cognitoIdentityPool.IdentityPool(
      this,
      "IdentityPool",
      {
        authenticationProviders: {
          userPools: [
            new cognitoIdentityPool.UserPoolAuthenticationProvider({
              userPool,
              userPoolClient,
            }),
          ],
        },
      }
    );

    const xOriginVerifySecret = new secretsmanager.Secret(
      this,
      "X-Origin-Verify-Secret",
      {
        removalPolicy: cdk.RemovalPolicy.DESTROY,
        generateSecretString: {
          excludePunctuation: true,
          generateStringKey: "headerValue",
          secretStringTemplate: "{}",
        },
      }
    );

    const { restApi } = this.createRestApi({
      xOriginVerifySecret,
      userPool,
      sessionTable,
      sessionBucket,
      uploadBucket,
      ...props,
    });

    const { webSocketApi } = this.createWebSocketApi({
      sessionTable,
      sessionBucket,
      uploadBucket,
      ...props,
    });

    const distribution = new cf.CloudFrontWebDistribution(
      this,
      "Distirbution",
      {
        viewerProtocolPolicy: cf.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        priceClass: cf.PriceClass.PRICE_CLASS_ALL,
        httpVersion: cf.HttpVersion.HTTP2_AND_3,
        originConfigs: [
          {
            behaviors: [{ isDefaultBehavior: true }],
            s3OriginSource: {
              s3BucketSource: websiteBucket,
              originAccessIdentity,
            },
          },
          {
            behaviors: [
              {
                pathPattern: "/api/*",
                allowedMethods: cf.CloudFrontAllowedMethods.ALL,
                viewerProtocolPolicy: cf.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                defaultTtl: cdk.Duration.seconds(0),
                forwardedValues: {
                  queryString: true,
                  headers: [
                    "Referer",
                    "Origin",
                    "Authorization",
                    "Content-Type",
                    "x-forwarded-user",
                    "Access-Control-Request-Headers",
                    "Access-Control-Request-Method",
                  ],
                },
              },
            ],
            customOriginSource: {
              domainName: `${restApi.restApiId}.execute-api.${cdk.Aws.REGION}.${cdk.Aws.URL_SUFFIX}`,
              originHeaders: {
                "X-Origin-Verify": xOriginVerifySecret
                  .secretValueFromJson("headerValue")
                  .unsafeUnwrap(),
              },
            },
          },
          {
            behaviors: [
              {
                pathPattern: "/socket",
                allowedMethods: cf.CloudFrontAllowedMethods.ALL,
                viewerProtocolPolicy: cf.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                forwardedValues: {
                  queryString: true,
                  headers: [
                    "Sec-WebSocket-Key",
                    "Sec-WebSocket-Version",
                    "Sec-WebSocket-Protocol",
                    "Sec-WebSocket-Accept",
                    "Sec-WebSocket-Extensions",
                  ],
                },
              },
            ],
            customOriginSource: {
              domainName: `${webSocketApi.apiId}.execute-api.${cdk.Aws.REGION}.${cdk.Aws.URL_SUFFIX}`,
              originHeaders: {
                "X-Origin-Verify": xOriginVerifySecret
                  .secretValueFromJson("headerValue")
                  .unsafeUnwrap(),
              },
            },
          },
        ],
        errorConfigurations: [
          {
            errorCode: 404,
            errorCachingMinTtl: 0,
            responseCode: 200,
            responsePagePath: "/index.html",
          },
        ],
      }
    );

    const exportsAsset = s3deploy.Source.jsonData("aws-exports.json", {
      region: cdk.Aws.REGION,
      Auth: {
        Cognito: {
          userPoolClientId: userPoolClient.userPoolClientId,
          userPoolId: userPool.userPoolId,
          identityPoolId: identityPool.identityPoolId,
        },
      },
      API: {
        REST: {
          RestApi: {
            endpoint: `https://${distribution.distributionDomainName}/api/v1`,
          },
        },
      },
      config: {
        websocket_endpoint: `wss://${distribution.distributionDomainName}/socket`,
      },
    });

    const asset = s3deploy.Source.asset(appPath, {
      bundling: {
        image: cdk.DockerImage.fromRegistry(
          "public.ecr.aws/sam/build-nodejs18.x:latest"
        ),
        command: [
          "sh",
          "-c",
          [
            "npm --cache /tmp/.npm install",
            `npm --cache /tmp/.npm run build`,
            "cp -aur /asset-input/dist/* /asset-output/",
          ].join(" && "),
        ],
        local: {
          tryBundle(outputDir: string) {
            try {
              const options: ExecSyncOptionsWithBufferEncoding = {
                stdio: "inherit",
                env: {
                  ...process.env,
                },
              };

              execSync(`npm --silent --prefix "${appPath}" install`, options);
              execSync(`npm --silent --prefix "${appPath}" run build`, options);
              Utils.copyDirRecursive(buildPath, outputDir);
            } catch (e) {
              console.error(e);
              return false;
            }

            return true;
          },
        },
      },
    });

    new s3deploy.BucketDeployment(this, "UserInterfaceDeployment", {
      prune: false,
      sources: [asset, exportsAsset],
      destinationBucket: websiteBucket,
      distribution,
    });

    this.userPool = userPool;
    this.distribution = distribution;
  }

  createRestApi({
    xOriginVerifySecret,
    userPool,
    lambdaArchitecture,
    powerToolsLayer,
    sessionTable,
    sessionBucket,
    uploadBucket,
  }: {
    xOriginVerifySecret: secretsmanager.ISecret;
    userPool: cognito.IUserPool;
    lambdaArchitecture: lambda.Architecture;
    powerToolsLayer: lambda.ILayerVersion;
    sessionTable: dynamodb.ITable;
    sessionBucket: s3.IBucket;
    uploadBucket: s3.IBucket;
  }) {
    const apiHandler = new lambdaPython.PythonFunction(this, "ApiHandler", {
      entry: path.join(__dirname, "./functions/api-handler"),
      runtime: lambda.Runtime.PYTHON_3_12,
      architecture: lambdaArchitecture,
      timeout: cdk.Duration.minutes(5),
      memorySize: 128,
      logRetention: logs.RetentionDays.ONE_WEEK,
      layers: [powerToolsLayer],
      environment: {
        X_ORIGIN_VERIFY_SECRET_ARN: xOriginVerifySecret.secretArn,
        SESSION_TABLE_NAME: sessionTable.tableName,
        SESSION_BUCKET_NAME: sessionBucket.bucketName,
        UPLOAD_BUCKET_NAME: uploadBucket.bucketName,
      },
    });

    sessionBucket.grantReadWrite(apiHandler);
    uploadBucket.grantReadWrite(apiHandler);
    sessionTable.grantReadWriteData(apiHandler);
    xOriginVerifySecret.grantRead(apiHandler);

    const restApi = new apigateway.RestApi(this, "RestApi", {
      endpointTypes: [apigateway.EndpointType.REGIONAL],
      cloudWatchRole: true,
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          "Content-Type",
          "Authorization",
          "X-Amz-Date",
          "X-Amz-Security-Token",
        ],
        maxAge: cdk.Duration.minutes(10),
      },
      deploy: true,
      deployOptions: {
        stageName: "api",
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        tracingEnabled: true,
        metricsEnabled: true,
        throttlingRateLimit: 2500,
      },
    });

    const cognitoAuthorizer = new apigateway.CfnAuthorizer(
      this,
      "ApiGatewayCognitoAuthorizer",
      {
        name: "CognitoAuthorizer",
        identitySource: "method.request.header.Authorization",
        providerArns: [userPool.userPoolArn],
        restApiId: restApi.restApiId,
        type: apigateway.AuthorizationType.COGNITO,
      }
    );

    const v1Resource = restApi.root.addResource("v1", {
      defaultMethodOptions: {
        authorizationType: apigateway.AuthorizationType.COGNITO,
        authorizer: { authorizerId: cognitoAuthorizer.ref },
      },
    });

    const v1ProxyResource = v1Resource.addResource("{proxy+}");
    v1ProxyResource.addMethod(
      "ANY",
      new apigateway.LambdaIntegration(apiHandler, {
        proxy: true,
      })
    );

    return { restApi };
  }

  createWebSocketApi({
    config,
    bedrockRegion,
    bedrockModel,
    lambdaArchitecture,
    powerToolsLayer,
    sessionTable,
    sessionBucket,
    uploadBucket,
    codeInterpreterTool,
    webSearchTool,
  }: {
    config: StackConfig;
    bedrockRegion: string;
    bedrockModel: string;
    lambdaArchitecture: lambda.Architecture;
    powerToolsLayer: lambda.ILayerVersion;
    sessionTable: dynamodb.ITable;
    sessionBucket: s3.IBucket;
    uploadBucket: s3.IBucket;
    codeInterpreterTool?: lambda.IFunction;
    webSearchTool?: lambda.IFunction;
  }) {
    const connectionsTable = new dynamodb.Table(this, "ConnectionsTable", {
      partitionKey: {
        name: "connectionId",
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    connectionsTable.addGlobalSecondaryIndex({
      indexName: "byUser",
      partitionKey: { name: "userId", type: dynamodb.AttributeType.STRING },
    });

    const connectionHandlerFunction = new lambda.Function(
      this,
      "ConnectionHandlerFunction",
      {
        code: lambda.Code.fromAsset(
          path.join(__dirname, "./functions/connection-handler")
        ),
        handler: "index.handler",
        runtime: lambda.Runtime.PYTHON_3_12,
        architecture: lambdaArchitecture,
        layers: [powerToolsLayer],
        environment: {
          CONNECTIONS_TABLE_NAME: connectionsTable.tableName,
        },
      }
    );

    connectionsTable.grantReadWriteData(connectionHandlerFunction);

    const authorizerFunction = new lambda.Function(this, "AuthorizerFunction", {
      code: lambda.Code.fromAsset(
        path.join(__dirname, "./functions/authorizer")
      ),
      handler: "index.handler",
      runtime: lambda.Runtime.PYTHON_3_12,
      architecture: lambdaArchitecture,
      layers: [powerToolsLayer],
    });

    const webSocketApi = new apigwv2.WebSocketApi(this, "WebSocketApi", {
      connectRouteOptions: {
        authorizer: new WebSocketLambdaAuthorizer(
          "Authorizer",
          authorizerFunction,
          {
            identitySource: ["route.request.querystring.token"],
          }
        ),
        integration: new WebSocketLambdaIntegration(
          "ConnectIntegration",
          connectionHandlerFunction
        ),
      },
      disconnectRouteOptions: {
        integration: new WebSocketLambdaIntegration(
          "DisconnectIntegration",
          connectionHandlerFunction
        ),
      },
    });

    const stage = new apigwv2.WebSocketStage(this, "WebSocketApiStage", {
      webSocketApi,
      stageName: "socket",
      autoDeploy: true,
    });

    const messageHandler = new lambdaPython.PythonFunction(
      this,
      "MessageHandler",
      {
        entry: path.join(__dirname, "./functions/message-handler"),
        runtime: lambda.Runtime.PYTHON_3_12,
        architecture: lambdaArchitecture,
        layers: [powerToolsLayer],
        timeout: cdk.Duration.minutes(15),
        memorySize: 256,
        environment: {
          WEBSOCKET_API_ENDPOINT: stage.callbackUrl,
          BEDROCK_REGION: bedrockRegion,
          BEDROCK_MODEL: bedrockModel,
          SESSION_TABLE_NAME: sessionTable.tableName,
          SESSION_BUCKET_NAME: sessionBucket.bucketName,
          UPLOAD_BUCKET_NAME: uploadBucket.bucketName,
          ARTIFACTS_ENABLED: config.artifacts?.enabled ? "1" : "0",
          TOOL_CODE_INTERPRETER: codeInterpreterTool?.functionArn ?? "",
          TOOL_WEB_SEARCH: webSearchTool?.functionArn ?? "",
        },
      }
    );

    messageHandler.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          "bedrock:InvokeModel",
          "bedrock:InvokeModelWithResponseStream",
        ],
        resources: [`*`],
      })
    );

    messageHandler.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["execute-api:ManageConnections"],
        resources: [
          `arn:${cdk.Aws.PARTITION}:execute-api:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:${webSocketApi.apiId}/${stage.stageName}/*/*`,
        ],
      })
    );

    webSocketApi.addRoute("$default", {
      integration: new WebSocketLambdaIntegration(
        "DefaultIntegration",
        messageHandler
      ),
    });

    codeInterpreterTool?.grantInvoke(messageHandler);
    webSearchTool?.grantInvoke(messageHandler);
    sessionTable.grantReadWriteData(messageHandler);
    sessionBucket.grantReadWrite(messageHandler);
    uploadBucket.grantReadWrite(messageHandler);

    return { webSocketApi };
  }
}
