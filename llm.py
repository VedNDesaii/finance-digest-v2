"""Shared LLM client for the whole pipeline.

If AWS credentials are present it talks to Claude on **AWS Bedrock** (so billing
goes through AWS, not the Anthropic Console); otherwise it falls back to the
Anthropic API key. No other code needs to know which one is active — just import
make_client() and MODEL_ID. USE_BEDROCK also lets callers skip Anthropic-only
features (e.g. the server-side web_search tool, which Bedrock doesn't provide).
"""
import os
from dotenv import load_dotenv

load_dotenv(override=False)

USE_BEDROCK = bool(os.getenv("AWS_ACCESS_KEY_ID") and os.getenv("AWS_SECRET_ACCESS_KEY"))

if USE_BEDROCK:
    from anthropic import AnthropicBedrock
    # Set BEDROCK_MODEL_ID in .env to the exact id shown in your Bedrock console
    # if this default doesn't match (region-prefixed inference-profile id).
    MODEL_ID = os.getenv("BEDROCK_MODEL_ID", "us.anthropic.claude-haiku-4-5-20251001-v1:0")

    def make_client(**kw):
        return AnthropicBedrock(
            aws_region=os.getenv("AWS_REGION", "us-east-1"),
            aws_access_key=os.getenv("AWS_ACCESS_KEY_ID"),
            aws_secret_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
            **kw,
        )
else:
    import anthropic
    MODEL_ID = os.getenv("ANTHROPIC_MODEL_ID", "claude-haiku-4-5-20251001")

    def make_client(**kw):
        key = (os.getenv("ANTHROPIC_API_KEY") or "").strip()
        return anthropic.Anthropic(api_key=key, **kw)
