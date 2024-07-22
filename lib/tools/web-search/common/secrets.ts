import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";

const client = new SecretsManagerClient();
const API_KEYS_SECRET_ARN = process.env.API_KEYS_SECRET_ARN;

let cachedSecret: {
  BRAVE_API_KEY?: string;
} | null = null;
let cacheExpiry: Date | null = null;

export async function getSecretValue() {
  const now = new Date();

  if (cachedSecret && cacheExpiry && now < cacheExpiry) {
    console.log("Returning cached secret value.");

    return cachedSecret;
  }

  const command = new GetSecretValueCommand({
    SecretId: API_KEYS_SECRET_ARN,
  });
  const data = await client.send(command);
  const secret = data.SecretString;

  if (secret) {
    cachedSecret = JSON.parse(secret);
    cacheExpiry = new Date(now.getTime() + 1 * 60 * 1000);

    return cachedSecret;
  }

  return {};
}
