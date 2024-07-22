import os
import boto3
from common.serialization import deserialize
from aws_lambda_powertools import Logger
from aws_lambda_powertools.event_handler.api_gateway import Router

router = Router()
logger = Logger()

SESSION_TABLE_NAME = os.environ.get("SESSION_TABLE_NAME")
SESSION_BUCKET_NAME = os.environ.get("SESSION_BUCKET_NAME")
s3_client = boto3.client("s3")
dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(SESSION_TABLE_NAME)


@router.get("/sessions")
def sessions():
    user_id = (
        router.current_event.get("requestContext", {})
        .get("authorizer", {})
        .get("claims", {})
        .get("cognito:username")
    )

    query_params = {
        "IndexName": "byEntityId",
        "KeyConditionExpression": "userId = :uid",
        "ExpressionAttributeValues": {":uid": user_id},
        "ScanIndexForward": False,
    }

    response = table.query(**query_params)
    items = response["Items"]

    last_evaluated_key = None
    if "LastEvaluatedKey" in response:
        last_evaluated_key = response["LastEvaluatedKey"]

    while last_evaluated_key:
        query_params["ExclusiveStartKey"] = last_evaluated_key
        response = table.query(**query_params)
        items.extend(response["Items"])

        if "LastEvaluatedKey" in response:
            last_evaluated_key = response["LastEvaluatedKey"]
        else:
            last_evaluated_key = None

    return {"ok": True, "data": items}


@router.get("/sessions/<session_id>")
def get_session(session_id: str):
    user_id = (
        router.current_event.get("requestContext", {})
        .get("authorizer", {})
        .get("claims", {})
        .get("cognito:username")
    )

    key = f"{user_id}/{session_id}/session.jsonb"
    exists = False
    messages = []
    try:
        response = s3_client.get_object(Bucket=SESSION_BUCKET_NAME, Key=key)
        data = deserialize(response["Body"].read())
        messages = convert_session_messages(data)

        exists = True
    except s3_client.exceptions.NoSuchKey:
        exists = False

    files = []
    if exists:
        try:
            files_key = f"{user_id}/{session_id}/files.json"
            response = s3_client.get_object(Bucket=SESSION_BUCKET_NAME, Key=files_key)
            files = deserialize(response["Body"].read(), compressed=False)
        except s3_client.exceptions.NoSuchKey:
            files = []

    return {
        "ok": True,
        "data": {
            "id": session_id,
            "exists": exists,
            "messages": messages,
            "files": files,
        },
    }


def convert_session_messages(data: dict):
    ret_value = []
    sequence_idx = 0
    messages = data["messages"]
    tool_extra = data["tool_extra"]

    message = None
    for current in messages:
        role = current.get("role")
        content = current.get("content")

        for item in content:
            sequence_idx += 1
            item_text = item.get("text")
            tool_use = item.get("toolUse")
            tool_result = item.get("toolResult")

            if item_text:
                if not message or message["role"] != role:
                    message = {
                        "role": role,
                        "content": [],
                    }

                    ret_value.append(message)

                message["content"].append(
                    {"kind": "text", "sequenceIdx": sequence_idx, "text": item_text}
                )
            elif tool_use:
                if not message or message["role"] != role:
                    message = {
                        "role": role,
                        "content": [],
                    }

                    ret_value.append(message)

                tool_use_id = tool_use.get("toolUseId")
                tool_name = tool_use.get("name")
                extra = tool_extra.get(tool_use_id, {})

                message["content"].append(
                    {
                        "kind": "tool-use",
                        "sequence_idx": sequence_idx,
                        "tool_use_id": tool_use_id,
                        "tool_name": tool_name,
                        "status": "running",
                        "extra": extra,
                    }
                )
            elif tool_result:
                tool_use_id = tool_result.get("toolUseId")
                status = tool_result.get("status")

                for candidate in message["content"]:
                    if candidate.get("tool_use_id") == tool_use_id:
                        candidate["status"] = status
                        break

    return ret_value
