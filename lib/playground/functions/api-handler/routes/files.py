import os
import boto3
import urllib.parse
from typing import List
from pydantic import BaseModel
from aws_lambda_powertools import Logger
from common.serialization import serialize
from aws_lambda_powertools.event_handler.api_gateway import Router

router = Router()
logger = Logger()

UPLOAD_BUCKET_NAME = os.environ.get("UPLOAD_BUCKET_NAME")
SESSION_BUCKET_NAME = os.environ.get("SESSION_BUCKET_NAME")
MAX_FILE_SIZE = 25 * 1000 * 1000  # 25Mb

s3_client = boto3.client("s3")


class FileUploadRequest(BaseModel):
    file_name: str


class FileDownloadRequest(BaseModel):
    file_id: str
    file_name: str


class SessionFileItem(BaseModel):
    checksum: str
    file_name: str


class SessionFilesRequest(BaseModel):
    files: List[SessionFileItem]


@router.post("/sessions/<session_id>/files/upload")
def file_upload(session_id: str):
    data: dict = router.current_event.json_body
    request = FileUploadRequest(**data)

    user_id = (
        router.current_event.get("requestContext", {})
        .get("authorizer", {})
        .get("claims", {})
        .get("cognito:username")
    )

    result = generate_presigned_post(user_id, session_id, request.file_name)

    return {"ok": True, "data": result}


@router.post("/sessions/<session_id>/files/download")
def file_donwload(session_id: str):
    data: dict = router.current_event.json_body
    request = FileDownloadRequest(**data)

    user_id = (
        router.current_event.get("requestContext", {})
        .get("authorizer", {})
        .get("claims", {})
        .get("cognito:username")
    )

    presigned_url = generate_presigned_url(
        user_id, session_id, request.file_id, request.file_name
    )

    return {"ok": True, "data": presigned_url}


@router.post("/sessions/<session_id>/files")
def set_session_files(session_id: str):
    data: dict = router.current_event.json_body
    request = SessionFilesRequest(**data)

    user_id = (
        router.current_event.get("requestContext", {})
        .get("authorizer", {})
        .get("claims", {})
        .get("cognito:username")
    )

    key = f"{user_id}/{session_id}/files.json"
    body = serialize(list(map(lambda val: val.dict(), request.files)), compressed=False)
    s3_client.put_object(Bucket=SESSION_BUCKET_NAME, Key=key, Body=body)

    return {"ok": True, "data": True}


def generate_presigned_post(
    user_id: str, session_id: str, file_name: str, expiration=3600
):
    s3_client = boto3.client("s3")
    file_name = os.path.basename(file_name)
    url_encoded_key = urllib.parse.quote(file_name)
    s3_key = f"{user_id}/{session_id}/request/{url_encoded_key}"

    conditions = [
        ["content-length-range", 0, MAX_FILE_SIZE],
    ]

    response = s3_client.generate_presigned_post(
        UPLOAD_BUCKET_NAME, s3_key, Conditions=conditions, ExpiresIn=expiration
    )

    if not response:
        return None

    response["url"] = f"https://{UPLOAD_BUCKET_NAME}.s3-accelerate.amazonaws.com"
    response["file_name"] = file_name

    return response


def generate_presigned_url(
    user_id: str, session_id: str, file_id: str, file_name: str, expiration=3600
):
    s3_client = boto3.client("s3")
    file_name = os.path.basename(file_name)
    url_encoded_key = urllib.parse.quote(file_name)
    s3_key = f"{user_id}/{session_id}/response/{file_id}/{url_encoded_key}"

    presigned_url = s3_client.generate_presigned_url(
        "get_object",
        Params={"Bucket": UPLOAD_BUCKET_NAME, "Key": s3_key},
        ExpiresIn=expiration,
    )

    return presigned_url
