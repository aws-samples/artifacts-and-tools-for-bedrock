import os
import uuid
import requests
import nbformat
import subprocess
import shutil

COMMON_CODE = """%matplotlib inline
import pandas as pd
import matplotlib.pyplot as plt"""


def handler(event, context):
    print("Running the code in a Jupyter notebook...")
    print(event)

    input = event.get("input", {})
    code = input.get("code")
    input_files = event.get("input_files", [])
    output_files = event.get("output_files", [])

    if code is None:
        return {"status": "error", "content": {"text": "No code provided."}}

    base_name = str(uuid.uuid4())
    base_path = f"/tmp/{base_name}"
    home_path = os.path.join(base_path, "home")
    notebooks_path = os.path.join(base_path, "notebooks")
    matplotlib_path = os.path.join(home_path, ".matplotlib")
    code_path = os.path.join(notebooks_path, f"{base_name}.ipynb")
    html_output_path = os.path.join(notebooks_path, f"{base_name}.html")
    asciidoc_output_path = os.path.join(notebooks_path, f"{base_name}.asciidoc")

    os.makedirs(base_path, exist_ok=True)
    os.makedirs(home_path, exist_ok=True)
    os.makedirs(notebooks_path, exist_ok=True)

    env = os.environ.copy()
    env["MPLCONFIGDIR"] = matplotlib_path
    env["HOME"] = home_path

    try:
        nb = nbformat.v4.new_notebook()
        nb.cells.append(nbformat.v4.new_code_cell(COMMON_CODE))
        nb.cells.append(nbformat.v4.new_code_cell(code))

        download_files(notebooks_path, input_files)

        with open(code_path, "w") as f:
            nbformat.write(nb, f)

        result = subprocess.run(
            [
                "jupyter",
                "nbconvert",
                "--execute",
                "--to",
                "notebook",
                "--output",
                code_path,
                code_path,
            ],
            env=env,
            cwd=notebooks_path,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )

        if result.returncode != 0:
            raise Exception(result.stderr)

        result_html = subprocess.run(
            [
                "jupyter",
                "nbconvert",
                "--no-input",
                "--template",
                "basic",
                "--to",
                "html",
                "--output",
                html_output_path,
                code_path,
            ],
            env=env,
            cwd=notebooks_path,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )

        if result_html.returncode != 0:
            raise Exception(result_html.stderr)

        result_asciidoc = subprocess.run(
            [
                "jupyter",
                "nbconvert",
                "--no-input",
                "--to",
                "asciidoc",
                "--output",
                asciidoc_output_path,
                code_path,
            ],
            env=env,
            cwd=notebooks_path,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )

        if result_asciidoc.returncode != 0:
            raise Exception(result_asciidoc.stderr)

        html_output = ""
        with open(html_output_path, "r") as f:
            html_output = f.read()

        asciidoc_output = ""
        with open(asciidoc_output_path, "r") as f:
            asciidoc_output = f.read()

        print(asciidoc_output)

        files_result = upload_files(output_files, notebooks_path)
        content_text = "Execution result in AsciiDoc format:\n" + asciidoc_output

        return {
            "status": "success",
            "content": {"text": content_text},
            "extra": {"html": html_output, "output_files": files_result},
        }
    except Exception as e:
        print(e)
        error_text = str(e)

        return {"status": "error", "content": {"text": error_text}}
    finally:
        shutil.rmtree(base_path)


def download_files(files_path, input_files):
    for file in input_files:
        file_name = file["file_name"]
        file_url = file["url"]

        file_path = os.path.join(files_path, file_name)

        response = requests.get(file_url)
        response.raise_for_status()

        with open(file_path, "wb") as f:
            for chunk in response.iter_content(chunk_size=8192):
                if chunk:  # Filter out keep-alive new chunks
                    f.write(chunk)

        print(f"Downloaded {file_name} successfully.")


def upload_files(output_files, base_path):
    ret_value = []

    print("Uploading output files...")
    print(f"Base path: {base_path}")
    print(f"Output files: {output_files}")

    for file_info in output_files:
        file_name = file_info["file_name"]
        file_id = file_info["file_id"]
        file_path = os.path.join(base_path, file_name)

        if not os.path.exists(file_path):
            print(f"File {file_name} does not exist.")
            continue

        print(f"Uploading {file_name}")

        url = file_info["url"]
        fields = file_info["fields"]

        with open(file_path, "rb") as f:
            files = {"file": (file_name, f)}
            response = requests.post(url, data=fields, files=files)

            if response.status_code == 204:
                print(f"Successfully uploaded {file_name}")

                ret_value.append(
                    {"file_id": file_id, "file_name": file_name, "url": url}
                )

            else:
                print(
                    f"Failed to upload {file_name}, status code: {response.status_code}"
                )

    return ret_value
