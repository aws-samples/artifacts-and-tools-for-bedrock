import {
  Box,
  Button,
  Container,
  FileUpload,
  Flashbar,
  FlashbarProps,
  Form,
  FormField,
  Header,
  Modal,
  ProgressBar,
  ProgressBarProps,
  SpaceBetween,
  TokenGroup,
} from "@cloudscape-design/components";
import { useState } from "react";
import { ApiClient } from "../../common/api-client/api-client";
import { FileUploader } from "../../common/file-uploader";
import { Utils } from "../../common/utils";
import { FileItem } from "../../types";

export interface FileDialogProps {
  sessionId: string;
  setVisible: (visible: boolean) => void;
  files: FileItem[];
  onAddFiles: (files: FileItem[]) => void;
  onRemoveFile: (file: FileItem) => void;
}

export default function FileDialog(props: FileDialogProps) {
  const [uploading, setUploading] = useState<boolean>(false);
  const [files, setFiles] = useState<File[]>([] as File[]);
  const [fileErrors, setFileErrors] = useState<string[]>([]);
  const [globalError, setGlobalError] = useState<string | undefined>(undefined);
  const [uploadError, setUploadError] = useState<string | undefined>(undefined);
  const [uploadingStatus, setUploadingStatus] =
    useState<FlashbarProps.Type>("info");
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadingIndex, setUploadingIndex] = useState<number>(0);
  const [currentFileName, setCurrentFileName] = useState<string>("");

  const onCloseButtonClick = () => {
    setFiles([]);
    props.setVisible(false);
  };

  const onSetFiles = (files: File[]) => {
    if (uploading) return;
    const errors: string[] = [];
    const filesToUpload: File[] = [];
    setUploadError(undefined);
    setUploadingStatus("info");

    if (files.length > 5) {
      setUploadError("Max 5 files allowed");
      files = files.slice(0, 5);
    }

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileName = file.name;
      if (fileName.includes(",")) {
        errors[i] = "File name cannot contain a comma";
      } else if (file.size > 1000 * 1000 * 10) {
        errors[i] = "File size is too large, max 10MB";
      } else {
        filesToUpload.push(file);
      }
    }

    setFiles(files);
    setFileErrors(errors);
    setFiles(filesToUpload);
  };

  const getProgressbarStatus = (): ProgressBarProps.Status => {
    if (uploadingStatus === "error") return "error";
    if (uploadingStatus === "success") return "success";
    return "in-progress";
  };

  const onUploadButtonClick = async () => {
    setUploading(true);
    setUploadingStatus("in-progress");
    setUploadProgress(0);
    setUploadingIndex(1);

    const uploader = new FileUploader();
    const apiClient = new ApiClient();
    const totalSize = files.reduce((acc, file) => acc + file.size, 0);
    let accumulator = 0;
    let hasError = false;

    const filesToAdd: FileItem[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const checksum = await Utils.calculateChecksum(file);
      setCurrentFileName(file.name);
      let fileUploaded = 0;

      try {
        const result = await apiClient.files.presignedFileUpload(
          props.sessionId,
          file.name,
        );

        filesToAdd.push({
          checksum,
          file_name: file.name,
        });

        try {
          await uploader.upload(file, result.data, (uploaded: number) => {
            fileUploaded = uploaded;
            const totalUploaded = fileUploaded + accumulator;
            const percent = Math.round((totalUploaded / totalSize) * 100);
            setUploadProgress(percent);
          });

          accumulator += file.size;
          setUploadingIndex(Math.min(files.length, i + 2));
        } catch (error) {
          console.error(error);
          setUploadingStatus("error");
          hasError = true;
          break;
        }
      } catch (error: unknown) {
        setGlobalError(Utils.getErrorMessage(error));
        console.error(Utils.getErrorMessage(error));
        setUploadingStatus("error");
        hasError = true;
        break;
      }
    }

    if (!hasError) {
      props.onAddFiles(filesToAdd);
      setUploadingStatus("success");
      setFiles([]);
    }

    setUploadError(undefined);
    setUploading(false);
  };

  const fileTokens = props.files.map((file) => ({
    id: file.checksum,
    label: file.file_name,
  }));

  return (
    <Modal
      onDismiss={() => props.setVisible(false)}
      visible={true}
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs" alignItems="center">
            <Button variant="link" onClick={onCloseButtonClick}>
              Close
            </Button>
            <Button
              variant="primary"
              disabled={uploading || !files.length}
              onClick={onUploadButtonClick}
            >
              Add files
            </Button>
          </SpaceBetween>
        </Box>
      }
      header="Add files"
    >
      <Form errorText={globalError}>
        <SpaceBetween size="l">
          {fileTokens.length > 0 && (
            <Container
              header={
                <Header variant="h3" description="Tools can use these files.">
                  Available Files
                </Header>
              }
            >
              <TokenGroup
                items={fileTokens}
                onDismiss={(event) =>
                  props.onRemoveFile(props.files[event.detail.itemIndex])
                }
              />
            </Container>
          )}
          {!uploading && (
            <FormField>
              <FileUpload
                onChange={({ detail }) => onSetFiles(detail.value)}
                value={files}
                i18nStrings={{
                  uploadButtonText: (e) => (e ? "Choose files" : "Choose file"),
                  dropzoneText: (e) =>
                    e ? "Drop files to upload" : "Drop file to upload",
                  removeFileAriaLabel: (e) => `Remove file ${e + 1}`,
                  limitShowFewer: "Show fewer files",
                  limitShowMore: "Show more files",
                  errorIconAriaLabel: "Error",
                }}
                multiple
                tokenLimit={3}
                constraintText="Files up to 10MB are supported"
                fileErrors={fileErrors}
                errorText={uploadError}
                showFileSize={true}
                showFileThumbnail={true}
              />
            </FormField>
          )}
          {uploadingStatus !== "info" && (
            <Flashbar
              items={[
                {
                  content: (
                    <ProgressBar
                      value={uploadProgress}
                      variant="flash"
                      description={
                        uploadingStatus === "success" ||
                        uploadingStatus === "error"
                          ? null
                          : currentFileName
                      }
                      label={
                        uploadingStatus === "success" ||
                        uploadingStatus === "error"
                          ? "Uploading files"
                          : `Uploading files ${uploadingIndex} of ${files.length}`
                      }
                      status={getProgressbarStatus()}
                      resultText={
                        uploadingStatus === "success"
                          ? "Upload complete"
                          : "Upload failed"
                      }
                    />
                  ),
                  type: uploadingStatus,
                  dismissible: false,
                },
              ]}
            />
          )}
        </SpaceBetween>
      </Form>
    </Modal>
  );
}
