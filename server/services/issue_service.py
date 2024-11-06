import json
import random
from pathlib import Path

def get_random_issue():
    """Get a random issue from the issues.json file"""
    print("Getting random issue")
    issues_path = "./data/issue.json"
    
    with open(issues_path, "r") as f:
        issues = json.load(f)
    random_issue = random.choice(issues)
    return random_issue 