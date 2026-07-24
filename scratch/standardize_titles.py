import json
import subprocess

def fetch_data(query):
    result = subprocess.run(
        ["mcp-cli", "call", "supabase", "execute_sql", f"--project_id=bnwwdseczwrmmuvallml", f"--query={query}"],
        capture_output=True, text=True
    )
    # The output from MCP is in a specific format, so let's just do it cleanly with a python script that calls the db directly if we had the connection string.
    pass
