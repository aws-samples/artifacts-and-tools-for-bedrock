import { post } from "aws-amplify/api";
import { API_NAME } from "../constants";
import { ApiClientBase } from "./api-client-base";
import { FileItem, FileUploadItem } from "../../types/app";

export interface PresignedFileUploadResult {
  ok: boolean;
  data: FileUploadItem;
}

export interface PresignedFileDownloadResult {
  ok: boolean;
  data: string;
}

export class FilesApiClient extends ApiClientBase {
  async presignedFileUpload(
    sessionId: string,
    fileName: string,
  ): Promise<PresignedFileUploadResult> {
    const headers = await this.getHeaders();
    const restOperation = post({
      apiName: API_NAME,
      path: `/sessions/${sessionId}/files/upload`,
      options: {
        headers,
        body: {
          file_name: fileName,
        },
      },
    });

    const response = await restOperation.response;
    const json_data = await response.body.json();
    const data = json_data as unknown as PresignedFileUploadResult;

    return data;
  }

  async presignedFileDonwload(
    sessionId: string,
    fileId: string,
    fileName: string,
  ): Promise<PresignedFileDownloadResult> {
    const headers = await this.getHeaders();
    const restOperation = post({
      apiName: API_NAME,
      path: `/sessions/${sessionId}/files/download`,
      options: {
        headers,
        body: {
          file_id: fileId,
          file_name: fileName,
        },
      },
    });

    const response = await restOperation.response;
    const json_data = await response.body.json();
    const data = json_data as unknown as PresignedFileDownloadResult;

    return data;
  }

  async setSessionFiles(
    sessionId: string,
    files: FileItem[],
  ): Promise<unknown> {
    const headers = await this.getHeaders();
    const restOperation = post({
      apiName: API_NAME,
      path: `/sessions/${sessionId}/files`,
      options: {
        headers,
        body: {
          files: files.map((f) => ({
            checksum: f.checksum,
            file_name: f.file_name,
          })),
        },
      },
    });

    const response = await restOperation.response;
    const json_data = await response.body.json();
    const data = json_data as unknown;

    return data;
  }
}
