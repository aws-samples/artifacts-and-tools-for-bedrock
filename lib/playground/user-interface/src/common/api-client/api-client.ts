import { FilesApiClient } from "./files-client";
import { SessionsApiClient } from "./sessions-client";

export class ApiClient {
  private _filesClient: FilesApiClient | undefined;
  private _sessionsClient: SessionsApiClient | undefined;

  public get files() {
    if (!this._filesClient) {
      this._filesClient = new FilesApiClient();
    }

    return this._filesClient;
  }

  public get sessions() {
    if (!this._sessionsClient) {
      this._sessionsClient = new SessionsApiClient();
    }

    return this._sessionsClient;
  }
}
