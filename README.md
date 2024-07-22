# Artifacts and Tools for Bedrock

Try **Artifacts** and **Code Interpreter Tool** with Amazon Bedrock. 

##  [>> EXAMPLES <<](EXAMPLES.md) 

## Table of contents
- [Overview](#overview)
- [Configuration](#configuration)
- [Deployment](#deployment)
- [Security](#security)
- [Supported AWS Regions](#supported-aws-regions)
- [Quotas](#quotas)
- [Clean up](#clean-up)

## Overview

This sample offers an innovative chat-based user interface with support for tools and artifacts. It can create graphs and diagrams, analyze data, write games, create web pages, generate files, and much more. The project uses the [Amazon Bedrock Converse API](https://docs.aws.amazon.com/bedrock/latest/userguide/conversation-inference.html).

| Capability | Description | Status |
| -------- | ------- | ------- |
| Artifacts        | Content and App Visualization | Available |
| Code Interpreter | Running code to accomplish tasks | Available |
| Web Search       | Using the Brave Search API to retrieve data | Available |
| SQL Client       | Accessing Amazon RDS databases to retrieve data | Coming soon  |

### Sample queries
```
Draw a graph of y = log(2x^2)e^x + 1
```
![sample](./assets/screen01.png "Screenshot")
```
Create a beautifully designed tic-tac-toe game.
```
![sample](./assets/screen02.png "Screenshot")
```
Create a beautifully designed user registration form.
```
![sample](./assets/screen03.png "Screenshot")

## Configuration

Before deploying the solution, make sure the configuration in ``bin/artifacts-and-tools.ts`` is correct.

```js
{
  bedrockRegion: "us-east-1",
  bedrockModel: "anthropic.claude-3-5-sonnet-20240620-v1:0",
  playground: {
    enabled: true,
  },
  artifacts: {
    enabled: true,
  },
  codeInterpreterTool: {
    enabled: true,
  },
  webSearchTool: {
    enabled: false,
  },
}
```

## Deployment
### Environment setup

#### Deploy with AWS Cloud9
We recommend deploying with [AWS Cloud9](https://aws.amazon.com/cloud9/). 
If you'd like to use Cloud9 to deploy the solution, you will need the following before proceeding:
- use `Amazon Linux 2023` as the platform.

#### Deploy with Github Codespaces
If you'd like to use [GitHub Codespaces](https://github.com/features/codespaces) to deploy the solution, you will need the following before proceeding:
1. An [AWS account](https://aws.amazon.com/premiumsupport/knowledge-center/create-and-activate-aws-account/)
2. An [IAM User](https://console.aws.amazon.com/iamv2/home?#/users/create) with:
  - `AdministratorAccess` policy granted to your user (for production, we recommend restricting access as needed)
  - Take note of `Access key` and `Secret access key`.

To get started, click on the button below.

[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/aws-samples/cloudscape-examples)

Once in the Codespaces terminal, set up the AWS Credentials by running

```shell
aws configure
```

```shell
AWS Access Key ID [None]: <the access key from the IAM user generated above>
AWS Secret Access Key [None]: <the secret access key from the IAM user generated above>
Default region name: <the region you plan to deploy the solution to>
Default output format: json
```

You are all set for deployment; you can now jump to [deployment](#deployment).

#### Local deployment
If you have decided not to use AWS Cloud9 or GitHub Codespaces, verify that your environment satisfies the following prerequisites:

You have:

1. An [AWS account](https://aws.amazon.com/premiumsupport/knowledge-center/create-and-activate-aws-account/)
2. `AdministratorAccess` policy granted to your AWS account (for production, we recommend restricting access as needed)
3. Both console and programmatic access
4. [NodeJS 20+](https://nodejs.org/en/download/) installed
    - If you are using [`nvm`](https://github.com/nvm-sh/nvm) you can run the following before proceeding
    - ```
      nvm install 20 && nvm use 20
      ```
5. [AWS CLI](https://aws.amazon.com/cli/) installed and configured to use with your AWS account
6. [Typescript 3.8+](https://www.typescriptlang.org/download) installed
7. [AWS CDK CLI](https://docs.aws.amazon.com/cdk/latest/guide/getting_started.html) installed
8. [Docker](https://docs.docker.com/get-docker/) installed
   - N.B. [`buildx`](https://github.com/docker/buildx) is also required. For Windows and macOS `buildx` [is included](https://github.com/docker/buildx#windows-and-macos) in [Docker Desktop](https://docs.docker.com/desktop/)

### Deployment

**Step 1.** Clone the repository
```bash
git clone https://github.com/aws-samples/artifacts-and-tools-for-bedrock
```
**Step 2.** Move into the cloned repository
```bash
cd artifacts-and-tools-for-bedrock
```

<a id="deployment-dependencies-installation"></a>
**Step 3.** Install the project dependencies by running this command

```bash
npm install
```

**Step 4.** (Optional) Bootstrap AWS CDK on the target account and region

> **Note**: This is required if you have never used AWS CDK on this account and region combination. ([More information on CDK bootstrapping](https://docs.aws.amazon.com/cdk/latest/guide/cli.html#cli-bootstrap)).

```bash
npx cdk bootstrap aws://{targetAccountId}/{targetRegion}
```

You can now deploy by running:

```bash
npx cdk deploy
```
You can view the progress of your CDK deployment in the [CloudFormation console](https://console.aws.amazon.com/cloudformation/home) in the selected region.

**Step 5.**  Once deployed, take note of the `UserInterfaceDomainName` that use can use to access the app.

```bash
...
Outputs:
ArtifactsAndToolsStack.UserInterfaceDomainName = https://dxxxxxxxxxxxxx.cloudfront.net
ArtifactsAndToolsStack.CognitoUserPool = https://xxxxx.console.aws.amazon.com/cognito/v2/
...
```

**Step 6.** Open the generated **CognitoUserPool** Link from outputs above i.e. `https://xxxxx.console.aws.amazon.com/cognito/v2/idp/user-pools/xxxxx_XXXXX/users?region=xxxxx`

**Step 7.** Add a user that will be used to log into the web interface.

**Step 8.** Open the `User Interface` Url for the outputs above, i.e. `dxxxxxxxxxxxxx.cloudfront.net`.

**Step 9.** Login with the user created in **Step 7** and follow the instructions.

### Web Search Tool Configuration

The Web Search Tool uses the [Brave Search API](https://brave.com/search/api/). To use the tool, you need to obtain an API key. After obtaining the API key, open the [AWS Secrets Manager](https://console.aws.amazon.com/secretsmanager/listsecrets) console and set the value for the secret specified in the output parameter ``ApiKeysSecretName``.

```json
{
  "BRAVE_API_KEY": "..."
}
```


## Local Development
### Get aws-exports.json from the backend
Before you can connect to the backend from the local machine, you should deploy the backend part and then download the ``aws-exports.json`` file with the configuration parameters from the website.

```
https://dxxxxxxxxxxxxx.cloudfront.net/aws-exports.json
```
It looks like this:

```json
{
  "region": "eu-west-1",
  "Auth": {
    "Cognito": {
      "userPoolClientId": "0000000000000000000000000",
      "userPoolId": "eu-west-0_AAAAAAAAA",
      "identityPoolId": "eu-west-1:aaaaaaaa-aaaaaaaaa-aaaa-aaaaaaaaaaaa"
    }
  },
  "API": {
    "REST": {
      "RestApi": { "endpoint": "https://aaaaaaaaaaaaaa.cloudfront.net/api/v1" }
    }
  },
  "config": {
    "websocket_endpoint": "wss://xxxxxxxxxxxxx.cloudfront.net/socket"
  }
}

```

Save the ``aws-exports.json`` file to the `lib/playground/user-interface/public` folder. 

### Run the App with backend access

1. Move into the user interface folder
```bash
cd user-interface
```
2. Install the project dependencies by running:
```bash
npm install
```
3. To start the development server, run:
```bash
npm run dev
```

This command will start a local development server at ``http://localhost:3000`` (or a different port if 3000 is in use). The server will hot-reload if you make edits to any of the source files.

## Security

When you build systems on AWS infrastructure, security responsibilities are shared between you and AWS. This [shared responsibility](http://aws.amazon.com/compliance/shared-responsibility-model/) model reduces your operational burden because AWS operates, manages, and controls the components including the host operating system, virtualization layer, and physical security of the facilities in which the services operate. For more information about AWS security, visit [AWS Cloud Security](http://aws.amazon.com/security/).

## Supported AWS Regions

This solution uses multiple AWS services, which might not be currently available in all AWS Regions. You must launch this construct in an AWS Region where these services are available. For the most current availability of AWS services by Region, see the [AWS Regional Services List](https://aws.amazon.com/about-aws/global-infrastructure/regional-product-services/).

## Quotas

Service quotas, also referred to as limits, are the maximum number of service resources or operations for your AWS account.

Make sure you have sufficient quota for each of the services implemented in this solution and the associated instance types. For more information, refer to [AWS service quotas](https://docs.aws.amazon.com/general/latest/gr/aws_service_limits.html).

To view the service quotas for all AWS services in the documentation without switching pages, view the information in the [Service endpoints and quotas](https://docs.aws.amazon.com/general/latest/gr/aws-general.pdf#aws-service-information) page in the PDF instead.

## Clean up

You can remove the stacks and all the associated resources created in your AWS account by running the following command:
```bash
npx cdk destroy
```
After deleting your stack, do not forget to delete the logs and content uploaded to the account.