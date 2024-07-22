import os
import json
import boto3
from common.sender import MessageSender
from common.system import system_messages
from tools import ToolProvider, ConverseToolExecutor, converse_tools
from common.files import (
    filter_inline_files,
    get_inline_file_data,
)
from common.session import load_session, save_session, create_dynamodb_session


AWS_REGION = os.environ["AWS_REGION"]
BEDROCK_REGION = os.environ.get("BEDROCK_REGION")
BEDROCK_MODEL = os.environ.get("BEDROCK_MODEL")
ARTIFACTS_ENABLED = os.environ.get("ARTIFACTS_ENABLED")
TOOL_CODE_INTERPRETER = os.environ.get("TOOL_CODE_INTERPRETER")
TOOL_WEB_SEARCH = os.environ.get("TOOL_WEB_SEARCH")


s3_client = boto3.client(
    "s3", region_name=AWS_REGION, endpoint_url=f"https://s3.{AWS_REGION}.amazonaws.com"
)
bedrock_client = boto3.client("bedrock-runtime", region_name=BEDROCK_REGION)

provider = ToolProvider(
    {
        "code_interpreter": TOOL_CODE_INTERPRETER,
        "web_search": TOOL_WEB_SEARCH,
    }
)

tool_config = []
if TOOL_CODE_INTERPRETER:
    tool_config.append(converse_tools.code_interpreter)
if TOOL_WEB_SEARCH:
    tool_config.append(converse_tools.web_search)


def handle_message(logger, connection_id, user_id, body):
    logger.info(f"Received message for {user_id}")
    logger.info(body)
    sender = MessageSender(connection_id)

    try:
        session_id = body.get("session_id")
        event_type = body.get("event_type")

        if not session_id:
            raise ValueError("Session ID is required")

        if event_type == "HEARTBEAT":
            sender.send_heartbeat()
        elif event_type == "CONVERSE":
            files = body.get("files", [])
            message = body.get("message")

            new_session, session = load_session(s3_client, user_id, session_id)
            converse_messages = session.get("messages")
            tool_extra = session.get("tool_extra")
            inline_files = session.get("inline_files")

            files_to_inline = filter_inline_files(files, inline_files)
            inline_files.extend(files_to_inline)
            inline_files_data = get_inline_file_data(
                s3_client, user_id, session_id, files_to_inline
            )

            content = []
            if message:
                content.append({"text": message})

            if inline_files_data:
                content.extend(
                    [
                        {
                            "image": {
                                "format": data["format"],
                                "source": {"bytes": data["data"]},
                            },
                        }
                        for data in inline_files_data
                    ]
                )
            if content:
                converse_messages.append(
                    {
                        "role": "user",
                        "content": content,
                    }
                )

            finish = converse_make_request_stream(
                sender,
                user_id,
                session_id,
                converse_messages,
                tool_extra,
                files,
            )

            if new_session:
                create_dynamodb_session(user_id, session_id, message)
            save_session(s3_client, user_id, session_id, session)

            sender.send_loop(finish)
        else:
            raise ValueError(f"Unknown event type: {event_type}")
    except Exception as e:
        logger.error(f"Error processing message: {e}")
        sender.send_error(str(e))

    return {"statusCode": 200, "body": json.dumps({"ok": True})}


def converse_make_request_stream(
    sender: MessageSender,
    user_id,
    session_id,
    converse_messages,
    tool_extra,
    files,
):
    file_names = [os.path.basename(file["file_name"]) for file in files]
    system = system_messages(ARTIFACTS_ENABLED == "1", file_names)

    additional_params = {}
    if tool_config:
        additional_params["toolConfig"] = {"tools": tool_config}

    streaming_response = bedrock_client.converse_stream(
        modelId=BEDROCK_MODEL,
        system=system,
        messages=converse_messages,
        inferenceConfig={"maxTokens": 4096, "temperature": 0.5},
        **additional_params,
    )

    executor = ConverseToolExecutor(user_id, session_id, provider)
    for chunk in streaming_response["stream"]:
        if text := executor.process_chunk(chunk):
            sender.send_text(text)

    assistant_messages = executor.get_assistant_messages()
    converse_messages.extend(assistant_messages)

    if executor.execution_requested():
        tool_use_extra = sender.send_tool_running_messages(executor)
        tool_extra.update(tool_use_extra)

        executor.execute(s3_client, file_names)
        user_messages = executor.get_user_messages()
        converse_messages.extend(user_messages)

        tool_results_extra = sender.send_tool_finished_messages(executor)

        for tool_use_id, extra in tool_results_extra.items():
            tool_extra.get(tool_use_id, {}).update(extra)

        return False

    return True
