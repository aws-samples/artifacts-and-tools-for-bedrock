import { fetchAuthSession } from "aws-amplify/auth";

export abstract class ApiClientBase {
  protected async getHeaders() {
    return {
      Authorization: `Bearer ${await this.getIdToken()}`,
    };
  }

  protected async getIdToken() {
    const session = await fetchAuthSession();
    return session.tokens?.idToken?.toString();
  }
}
