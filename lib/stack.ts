import * as path from "node:path";
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { StackConfig } from "./types";
import { Playground } from "./playground";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as iam from "aws-cdk-lib/aws-iam";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";

const lambdaArchitecture = lambda.Architecture.X86_64;

/*
Tool request format: 
{
  "tool_use_id": "1234",
  "name": "stock-price",
  "input": {
    "ticker": "AMZN"
  }
}
*/

export interface ArtifactsAndToolsStackProps extends cdk.StackProps {
  config: StackConfig;
}

export class ArtifactsAndToolsStack extends cdk.Stack {
  constructor(
    scope: Construct,
    id: string,
    props: ArtifactsAndToolsStackProps
  ) {
    super(scope, id, {
      description: "Artifacts and Tools (uksb-l8wk3n27zh)",
      ...props,
    });

    const bedrockRegion = props.config.bedrockRegion ?? cdk.Aws.REGION;
    const bedrockModel = props.config.bedrockModel;
    const powerToolsLayerVersion = "72";
    const powerToolsLayer = lambda.LayerVersion.fromLayerVersionArn(
      this,
      "PowertoolsLayer",
      lambdaArchitecture === lambda.Architecture.X86_64
        ? `arn:${cdk.Aws.PARTITION}:lambda:${cdk.Aws.REGION}:017000801446:layer:AWSLambdaPowertoolsPythonV2:${powerToolsLayerVersion}`
        : `arn:${cdk.Aws.PARTITION}:lambda:${cdk.Aws.REGION}:017000801446:layer:AWSLambdaPowertoolsPythonV2-Arm64:${powerToolsLayerVersion}`
    );

    const apiKeysSecret = new secretsmanager.Secret(this, "ApiKeysSecret", {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      secretObjectValue: {},
    });

    let codeInterpreterTool: lambda.IFunction | undefined;
    if (props.config.codeInterpreterTool?.enabled) {
      const codeInterpreterVpc = new ec2.Vpc(this, "CodeInterpreterVPC", {
        maxAzs: 2,
        natGateways: 0,
        createInternetGateway: false,
        subnetConfiguration: [
          {
            cidrMask: 24,
            name: "PrivateSubnet",
            subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
          },
        ],
      });

      codeInterpreterVpc.addGatewayEndpoint("CodeInterpreterS3Endpoint", {
        service: ec2.GatewayVpcEndpointAwsService.S3,
      });

      const codeInterpreterLogGroup = new logs.LogGroup(
        this,
        "CodeInterpreterLogGroup",
        {
          retention: logs.RetentionDays.ONE_WEEK,
          removalPolicy: cdk.RemovalPolicy.DESTROY,
        }
      );

      const codeInterpreterRole = new iam.Role(
        this,
        "CodeInterpreterExecutionRole",
        {
          assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
          inlinePolicies: {
            lambdaAccess: new iam.PolicyDocument({
              statements: [
                new iam.PolicyStatement({
                  effect: iam.Effect.ALLOW,
                  actions: [
                    "ec2:CreateNetworkInterface",
                    "ec2:DescribeNetworkInterfaces",
                    "ec2:DescribeSubnets",
                    "ec2:DeleteNetworkInterface",
                    "ec2:AssignPrivateIpAddresses",
                    "ec2:UnassignPrivateIpAddresses",
                  ],
                  resources: ["*"],
                }),
                new iam.PolicyStatement({
                  effect: iam.Effect.ALLOW,
                  actions: ["logs:CreateLogStream", "logs:PutLogEvents"],
                  resources: [codeInterpreterLogGroup.logGroupArn],
                }),
              ],
            }),
          },
        }
      );

      codeInterpreterTool = new lambda.DockerImageFunction(
        this,
        "CodeInterpreterTool",
        {
          code: lambda.DockerImageCode.fromImageAsset(
            path.join(__dirname, "./tools/code-interpreter")
          ),
          architecture: lambdaArchitecture,
          timeout: cdk.Duration.minutes(15),
          memorySize: 2048,
          logGroup: codeInterpreterLogGroup,
          vpc: codeInterpreterVpc,
          vpcSubnets: {
            subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
          },
          role: codeInterpreterRole,
        }
      );

      new cdk.CfnOutput(this, "CodeInterpreterToolArn", {
        value: codeInterpreterTool.functionArn,
      });
    }

    let webSearchTool: lambda.IFunction | undefined;
    if (props.config.webSearchTool?.enabled) {
      const webSearchLogGroup = new logs.LogGroup(this, "WebSearchLogGroup", {
        retention: logs.RetentionDays.ONE_WEEK,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      });

      webSearchTool = new lambda.Function(this, "WebSearchTool", {
        architecture: lambdaArchitecture,
        timeout: cdk.Duration.minutes(15),
        memorySize: 2048,
        handler: "index.handler",
        logGroup: webSearchLogGroup,
        runtime: lambda.Runtime.NODEJS_20_X,
        code: lambda.Code.fromDockerBuild(
          path.join(__dirname, "./tools/web-search")
        ),
        environment: {
          API_KEYS_SECRET_ARN: apiKeysSecret.secretArn,
        },
      });

      apiKeysSecret.grantRead(webSearchTool);

      new cdk.CfnOutput(this, "WebSearchToolArn", {
        value: webSearchTool.functionArn,
      });
    }

    if (props.config.playground?.enabled) {
      const playground = new Playground(this, "Playground", {
        config: props.config,
        bedrockRegion,
        bedrockModel,
        lambdaArchitecture,
        powerToolsLayer,
        codeInterpreterTool,
        webSearchTool,
      });

      new cdk.CfnOutput(this, "CognitoUserPool", {
        value: `https://${
          cdk.Stack.of(this).region
        }.console.aws.amazon.com/cognito/v2/idp/user-pools/${
          playground.userPool.userPoolId
        }/users?region=${cdk.Stack.of(this).region}`,
      });

      new cdk.CfnOutput(this, "UserInterfaceDomainName", {
        value: `https://${playground.distribution.distributionDomainName}`,
      });
    }

    new cdk.CfnOutput(this, "ApiKeysSecretName", {
      value: apiKeysSecret.secretName,
    });
  }
}
