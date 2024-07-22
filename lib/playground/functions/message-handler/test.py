import os
import boto3
from common.system import system_messages
from tools import ToolProvider, ConverseToolExecutor, converse_tools

BEDROCK_REGION = "us-east-1"
BEDROCK_MODEL = "anthropic.claude-3-sonnet-20240229-v1:0"
TOOL_WEB_SEARCH = os.environ.get("TOOL_WEB_SEARCH")
TOOL_CODE_INTERPRETER = os.environ.get("TOOL_CODE_INTERPRETER")

bedrock_client = boto3.client("bedrock-runtime", region_name=BEDROCK_REGION)
tool_config = [converse_tools.web_search, converse_tools.code_interpreter]
tool_config = []

provider = ToolProvider(
    {
        # "web_search": TOOL_WEB_SEARCH,
        # "code_interpreter": TOOL_CODE_INTERPRETER,
    }
)


def main():
    converse_messages = [
        {
            "role": "user",
            "content": [{"text": "Create a model of the solar system"}],
        }
    ]

    print("**** START ****")
    converse_make_request_stream(converse_messages)


def converse_make_request_stream(converse_messages):
    additional_params = {}
    if tool_config:
        additional_params["toolConfig"] = {"tools": tool_config}

    streaming_response = bedrock_client.converse_stream(
        modelId=BEDROCK_MODEL,
        system=system_messages,
        messages=converse_messages,
        inferenceConfig={"maxTokens": 4096, "temperature": 0.5},
        **additional_params,
    )

    executor = ConverseToolExecutor("usr1", "sess1", provider)
    for chunk in streaming_response["stream"]:
        # print(chunk, flush=True)
        if text := executor.process_chunk(chunk):
            print(text, end="", flush=True)

    assistant_messages = executor.get_assistant_messages()
    converse_messages.extend(assistant_messages)

    if executor.execution_requested():
        print("\n*** Execution requested ***")
        tool_use = executor.get_formatted_tool_use()
        print(tool_use)

        executor.execute(None, [])
        user_messages = executor.get_user_messages()
        converse_messages.extend(user_messages)

        converse_make_request_stream(converse_messages)


if __name__ == "__main__":
    main()
