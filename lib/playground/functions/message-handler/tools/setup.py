from setuptools import setup, find_packages

setup(
    name="tools_common",
    version="0.1.0",
    packages=find_packages(),
    install_requires=["boto3>=1.34.125"],
    python_requires=">=3.10",
)
