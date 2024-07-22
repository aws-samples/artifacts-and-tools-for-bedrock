import json
from .provider import ToolProvider
from common.files import generate_presigned_get, generate_presigned_post


class ConverseToolExecutor:
    def __init__(
        self, user_id: str, session_id: str, provider: ToolProvider = ToolProvider()
    ):
        self.user_id = user_id
        self.session_id = session_id
        self.provider = provider
        self.text_accumulator = ""
        self.tool_use = {}
        self.stop_on_tool_use = False
        self.tool_results = []

    def process_chunk(self, chunk):
        content_block_start = chunk.get("contentBlockStart")
        content_block_stop = chunk.get("contentBlockStop")
        contend_block_delta = chunk.get("contentBlockDelta")
        stop_reason = chunk.get("messageStop", {}).get("stopReason")
        if stop_reason == "tool_use":
            self.stop_on_tool_use = True

        content_block_index = None
        if content_block_start:
            content_block_index = content_block_start.get("contentBlockIndex")
        elif content_block_stop:
            content_block_index = content_block_stop.get("contentBlockIndex")
        elif contend_block_delta:
            content_block_index = contend_block_delta.get("contentBlockIndex")

        delta = None
        text = None
        tool_use = None
        if content_block_start:
            start = content_block_start.get("start")
            tool_use = start.get("toolUse")
        elif contend_block_delta:
            delta = contend_block_delta.get("delta")
            tool_use = delta.get("toolUse")
            text = delta.get("text")

        if text:
            self.text_accumulator += text
            return text
        if tool_use:
            current_tool_use = self.tool_use.get(content_block_index)
            if not current_tool_use:
                current_tool_use = {
                    "toolUseId": "",
                    "name": "",
                    "input": "",
                }
                self.tool_use[content_block_index] = current_tool_use

            current_tool_use_id = tool_use.get("toolUseId")
            if current_tool_use_id:
                current_tool_use["toolUseId"] = current_tool_use_id
            current_tool_use_name = tool_use.get("name")
            if current_tool_use_name:
                current_tool_use["name"] = current_tool_use_name
            current_input = tool_use.get("input")
            if current_input:
                current_tool_use["input"] += current_input

        return None

    def process_response(self, response):
        stop_reason = response.get("stopReason")
        if stop_reason == "tool_use":
            self.stop_on_tool_use = True

        content = response.get("output", {}).get("message", {}).get("content", [])

        for idx, current in enumerate(content):
            text = current.get("text")
            tool_use = current.get("toolUse")

            if text:
                self.text_accumulator += text

            if tool_use:
                current_tool_use = {
                    "toolUseId": tool_use.get("toolUseId"),
                    "name": tool_use.get("name"),
                    "input": tool_use.get("input"),
                }

                self.tool_use[idx] = current_tool_use

    def get_text(self):
        return self.text_accumulator

    def execution_requested(self):
        return self.stop_on_tool_use

    def execute(self, s3_client, file_names: list = []):
        tool_use = self.get_formatted_tool_use()

        input_files = []
        for file_name in file_names:
            file = generate_presigned_get(
                s3_client, self.user_id, self.session_id, file_name
            )

            input_files.append(file)

        for current in tool_use:
            tool_use_id = current["toolUseId"]
            tool_name = current["name"]
            input = current["input"]

            output_file_names = input.get("output_files", [])
            if type(output_file_names) != list:
                if type(output_file_names) == str:
                    try:
                        output_file_names = json.loads(
                            output_file_names.replace("'", '"')
                        )
                    except json.JSONDecodeError:
                        output_file_names = [output_file_names]

            output_files = []
            for file_name in output_file_names:
                file = generate_presigned_post(
                    s3_client, self.user_id, self.session_id, file_name
                )

                output_files.append(file)

            response = self.provider.execute(
                {
                    "tool_use_id": tool_use_id,
                    "name": tool_name,
                    "input": input,
                    "input_files": input_files,
                    "output_files": output_files,
                },
            )

            self.tool_results.append(
                {
                    "toolUseId": tool_use_id,
                    "status": response["status"],
                    "name": tool_name,
                    "content": response.get("content"),
                    "extra": response.get("extra", {}),
                }
            )

    def get_assistant_messages(self):
        if not self.text_accumulator and not self.tool_use:
            return []

        content = []
        if self.text_accumulator:
            content.append({"text": self.text_accumulator})

        tool_use = self.get_formatted_tool_use()
        values = [{"toolUse": current} for current in tool_use]
        content.extend(values)

        messages = [
            {
                "role": "assistant",
                "content": content,
            }
        ]

        return messages

    def get_user_messages(self):
        messages = [
            {
                "role": "user",
                "content": [
                    {
                        "toolResult": {
                            "toolUseId": current["toolUseId"],
                            "status": current["status"],
                            "content": [current["content"]],
                        }
                    }
                    for current in self.tool_results
                ],
            }
        ]

        return messages

    def get_formatted_tool_use(self):
        tool_use = []

        for current in self.tool_use.values():
            input = current["input"]
            if isinstance(input, str):
                input = json.loads(input)
            input = input or {}

            tool_use.append(
                {
                    "toolUseId": current["toolUseId"],
                    "name": current["name"],
                    "input": input,
                }
            )

        return tool_use

    def get_tool_results(self):
        return self.tool_results
