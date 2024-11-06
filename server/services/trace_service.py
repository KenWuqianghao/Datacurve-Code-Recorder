import json
from pathlib import Path
from datetime import datetime
import difflib
import os

def generate_diff(old_content: str, new_content: str) -> str:
    """Generate a git-style diff between two strings"""
    diff = difflib.unified_diff(
        old_content.splitlines(keepends=True),
        new_content.splitlines(keepends=True),
        fromfile='before',
        tofile='after'
    )
    return ''.join(diff)

def save_trace(trace: dict) -> dict:
    """Save a trace to a JSON file"""
    try:
        # Create traces directory if it doesn't exist
        traces_dir = Path(__file__).parent.parent / "traces"
        traces_dir.mkdir(parents=True, exist_ok=True)

        # Generate filename with timestamp
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"trace_{timestamp}.json"
        
        # Save trace to file
        file_path = traces_dir / filename
        with open(file_path, 'w') as f:
            json.dump(trace, f, indent=2)
        
        return {"message": "Trace saved successfully", "filename": filename}
    
    except Exception as e:
        raise Exception(f"Error saving trace: {str(e)}")

def generate_final_report() -> dict:
    """Generate final report from all traces in the current recording session"""
    try:
        traces_dir = Path(__file__).parent.parent / "traces"
        trace_files = sorted(traces_dir.glob("trace_*.json"))
        
        if not trace_files:
            raise Exception("No traces found")
        
        # First file should be the initial state
        with open(trace_files[0], 'r') as f:
            initial_state = json.load(f)
            
        # Get initial repository state
        if 'repository' in initial_state:
            # Handle initial issue format
            initial_repository = initial_state['repository']
            issue = initial_state['issue']
        else:
            # Handle execution trace format
            initial_repository = initial_state['initial_repository']
            issue = initial_state['issue']
        
        actions = []
        current_repository = initial_repository
        
        # Process each subsequent trace file
        for trace_file in trace_files[1:]:
            with open(trace_file, 'r') as f:
                trace = json.load(f)
                
            if 'modified_repository' not in trace:
                continue
                
            # Get the current file being modified
            current_file = trace.get('current_file')
            if not current_file:
                continue
                
            # Get old and new content for the current file
            old_content = next(
                (file['content'] for file in current_repository 
                 if file['filename'] == current_file),
                ''
            )
            new_content = next(
                (file['content'] for file in trace['modified_repository'] 
                 if file['filename'] == current_file),
                old_content
            )
            
            # Add edit action if content changed
            if old_content != new_content:
                actions.append({
                    "action": "edit_code",
                    "diff": generate_diff(old_content, new_content),
                    "timestamp": int(datetime.now().timestamp() * 1000)
                })
            
            # Add execute action
            execution_result = trace.get('execution_result', '')
            actions.append({
                "action": "execute_code",
                "execution_result": "success" if "error" not in execution_result.lower() else "error",
                "timestamp": int(datetime.now().timestamp() * 1000)
            })
            
            # Update current repository state
            current_repository = trace['modified_repository']
        
        # Create final report
        final_report = {
            "issue": issue,
            "initial_code": initial_repository,
            "pull_request": current_repository,
            "actions": actions
        }
        
        # Save final report
        report_path = traces_dir / f"final_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(report_path, 'w') as f:
            json.dump(final_report, f, indent=2)
        
        # Clean up intermediate traces
        for trace_file in trace_files:
            try:
                os.remove(trace_file)
            except Exception as e:
                print(f"Warning: Could not remove trace file {trace_file}: {e}")
        
        return final_report
        
    except Exception as e:
        print(f"Error generating final report: {e}")  # Debug log
        raise Exception(f"Error generating final report: {str(e)}")