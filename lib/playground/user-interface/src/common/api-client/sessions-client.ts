import { get } from "aws-amplify/api";
import { ApiClientBase } from "./api-client-base";
import { API_NAME } from "../constants";
import { ChatMessage, FileItem } from "../../types";

export interface GetSessionData {
  id: string;
  exists: boolean;
  messages: ChatMessage[];
  files: FileItem[];
}

export interface ListSessionData {
  userId: string;
  sessionId: string;
  created: string;
  entityId: string;
  title: string;
}

export class SessionsApiClient extends ApiClientBase {
  async listSessions(): Promise<ListSessionData[]> {
    const headers = await this.getHeaders();
    const restOperation = get({
      apiName: API_NAME,
      path: "/sessions",
      options: {
        headers,
      },
    });

    const response = await restOperation.response;
    const { data } = (await response.body.json()) as unknown as {
      data: ListSessionData[];
    };

    return data;
  }

  async getSession(sessionId: string): Promise<GetSessionData> {
    const headers = await this.getHeaders();
    const restOperation = get({
      apiName: API_NAME,
      path: `/sessions/${sessionId}`,
      options: {
        headers,
      },
    });

    const response = await restOperation.response;
    const { data } = (await response.body.json()) as unknown as {
      data: GetSessionData;
    };

    return data;
  }
}
