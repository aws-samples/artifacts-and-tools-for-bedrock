import os
import uuid
import urllib.parse

AWS_REGION = os.environ["AWS_REGION"]
MAX_FILE_SIZE = 100 * 1000 * 1000  # 100Mb
UPLOAD_BUCKET_NAME = os.environ.get("UPLOAD_BUCKET_NAME")


def generate_presigned_get(s3_client, user_id: str, session_id: str, file_name: str):
    file_name = os.path.basename(file_name)
    url_encoded_key = urllib.parse.quote(file_name)
    s3_key = f"{user_id}/{session_id}/request/{url_encoded_key}"

    presigned_url = s3_client.generate_presigned_url(
        "get_object",
        Params={"Bucket": UPLOAD_BUCKET_NAME, "Key": s3_key},
        ExpiresIn=15 * 60,
    )

    return {
        "file_name": file_name,
        "url": presigned_url,
    }


def generate_presigned_post(
    s3_client, user_id: str, session_id: str, file_name: str, expiration=3600
):
    file_name = os.path.basename(file_name)
    url_encoded_key = urllib.parse.quote(file_name)
    file_id = str(uuid.uuid4())
    object_name = f"{user_id}/{session_id}/response/{file_id}/{url_encoded_key}"

    conditions = [
        ["content-length-range", 0, MAX_FILE_SIZE],
    ]

    response = s3_client.generate_presigned_post(
        UPLOAD_BUCKET_NAME, object_name, Conditions=conditions, ExpiresIn=expiration
    )

    if not response:
        return None

    response["url"] = f"https://{UPLOAD_BUCKET_NAME}.s3.{AWS_REGION}.amazonaws.com"
    response["file_id"] = file_id
    response["file_name"] = file_name

    return response


def filter_inline_files(files, inline_files):
    ret_value = []
    checksums = [file.get("checksum") for file in inline_files]

    for file in files:
        file_name = file.get("file_name")
        checksum = file.get("checksum")

        if checksum in checksums:
            continue

        format = file_name.split(".")[-1].lower()
        if format == "jpg":
            format = "jpeg"

        if format in ["png", "jpeg", "webp"]:
            ret_value.append(
                {
                    "format": format,
                    "checksum": checksum,
                    "file_name": file_name,
                }
            )

    return ret_value


def get_inline_file_data(s3_client, user_id, session_id, files_to_inline):
    ret_value = []

    for file_to_inline in files_to_inline:
        format = file_to_inline.get("format")
        file_name = file_to_inline.get("file_name")
        file_name = os.path.basename(file_name)
        url_encoded_key = urllib.parse.quote(file_name)
        s3_key = f"{user_id}/{session_id}/request/{url_encoded_key}"

        response = s3_client.get_object(Bucket=UPLOAD_BUCKET_NAME, Key=s3_key)
        file_content = response["Body"].read()

        ret_value.append(
            {
                "format": format,
                "data": file_content,
            }
        )

    return ret_value
