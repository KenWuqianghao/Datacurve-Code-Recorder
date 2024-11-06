from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, validator
from typing import List, Optional, Literal
from services.issue_service import get_random_issue
from services.execution_service import execute_code
from services.trace_service import save_trace, generate_final_report
import uvicorn
from datetime import datetime

# Define our data models using Pydantic
class CodeAction(BaseModel):
    action: Literal['edit_code', 'execute_code']
    timestamp: int
    diff: Optional[str] = None
    execution_result: Optional[Literal['success', 'error']] = None

    @validator('diff')
    def validate_diff_for_edit(cls, v, values):
        if values.get('action') == 'edit_code' and not v:
            raise ValueError('diff is required for edit_code action')
        return v

    @validator('execution_result')
    def validate_result_for_execute(cls, v, values):
        if values.get('action') == 'execute_code' and not v:
            raise ValueError('execution_result is required for execute_code action')
        return v

class CodeTrace(BaseModel):
    issue: str
    initial_code: str
    pull_request: str
    actions: List[CodeAction]

class Repository(BaseModel):
    filename: str
    content: str

class TraceData(BaseModel):
    issue: str
    initial_repository: List[Repository]
    modified_repository: List[Repository]
    current_file: str

class CodeExecuteRequest(BaseModel):
    code: str
    trace: Optional[TraceData] = None

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # React dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/issues/random")
async def random_issue():
    try:
        issue = get_random_issue()
        # save a inital copy to trace
        print(issue)
        save_trace(issue)
        return issue
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/execute")
async def execute_code_endpoint(request: CodeExecuteRequest):
    try:
        # Execute the code
        result = execute_code(request.code)
        
        # If there's trace data, save it
        if request.trace:
            trace = {
                "issue": request.trace.issue,
                "initial_repository": [repo.dict() for repo in request.trace.initial_repository],
                "modified_repository": [repo.dict() for repo in request.trace.modified_repository],
                "current_file": request.trace.current_file,
                "timestamp": datetime.now().strftime("%Y%m%d_%H%M%S"),
                "execution_result": result
            }
            save_trace(trace)
            
        return {"message": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/traces")
async def create_trace(trace: CodeTrace):
    try:
        saved_trace = save_trace(trace.dict())
        return saved_trace
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/recording/stop")
async def stop_recording():
    try:
        final_report = generate_final_report()
        return final_report
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=3001, reload=True) 