import os
import boto3
import datetime
from common.serialization import serialize, deserialize

SESSION_TABLE_NAME = os.environ.get("SESSION_TABLE_NAME")
SESSION_BUCKET_NAME = os.environ.get("SESSION_BUCKET_NAME")

dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(SESSION_TABLE_NAME)


def load_session(s3_client, user_id: str, session_id: str):
    key = f"{user_id}/{session_id}/session.jsonb"
    new_session = False

    try:
        response = s3_client.get_object(Bucket=SESSION_BUCKET_NAME, Key=key)
        data = deserialize(response["Body"].read())
    except s3_client.exceptions.NoSuchKey:
        data = {
            "session_id": session_id,
            "messages": [],
            "tool_extra": {},
            "inline_files": [],
        }
        new_session = True

    return new_session, data


def save_session(s3_client, user_id: str, session_id: str, session: dict):
    key = f"{user_id}/{session_id}/session.jsonb"
    body = serialize(session)

    s3_client.put_object(Bucket=SESSION_BUCKET_NAME, Key=key, Body=body)


def create_dynamodb_session(user_id: str, session_id: str, title: str = ""):
    now = datetime.datetime.now()
    timestamp = int(now.timestamp())

    response = table.put_item(
        Item={
            "userId": user_id,
            "sessionId": session_id,
            "entityId": f"{session_id}/{timestamp}",
            "title": title[:128],
            "created": now.isoformat(),
        }
    )

    print(response)

    return response
