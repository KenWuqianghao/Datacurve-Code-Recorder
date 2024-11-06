import React, { useState, useEffect, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import styled from '@emotion/styled';
import axios from 'axios';

interface CodeAction {
  action: 'edit_code' | 'execute_code';
  timestamp: number;
  diff?: string;
  execution_result?: 'success' | 'error';
}

interface RepoFile {
  filename: string;
  content: string;
}

interface Issue {
  issue: string;
  initial_code: string;
  repository: RepoFile[];
}

// Add new interface for execution response
interface ExecutionResponse {
  success: boolean;
  output: string | null;
  error: string | null;
}

const Container = styled.div`
  padding: 2rem;
  max-width: 1400px;
  margin: 0 auto;
`;

const EditorContainer = styled.div`
  display: flex;
  gap: 1rem;
  height: 70vh;
`;

const EditorWrapper = styled.div`
  flex: 2;
  position: relative;
`;

const SidePanel = styled.div`
  flex: 1;
  background: #1e1e1e;
  border-radius: 4px;
  padding: 1rem;
  color: #fff;
  overflow-y: auto;
  font-family: 'Consolas', 'Monaco', monospace;
`;

const OutputEntry = styled.div<{ type: 'success' | 'error' }>`
  margin-bottom: 1rem;
  padding: 0.5rem;
  border-radius: 4px;
  background: ${props => props.type === 'success' ? '#143321' : '#3c1f1f'};
  border-left: 3px solid ${props => props.type === 'success' ? '#28a745' : '#dc3545'};
`;

const TimeStamp = styled.div`
  font-size: 0.8rem;
  color: #666;
  margin-bottom: 0.3rem;
`;

const Header = styled.header`
  margin-bottom: 2rem;
`;

const ControlPanel = styled.div`
  display: flex;
  gap: 1rem;
  margin-bottom: 1rem;
  align-items: center;
`;

const Button = styled.button<{ isRecording?: boolean }>`
  padding: 0.5rem 1rem;
  border-radius: 4px;
  border: none;
  cursor: pointer;
  font-weight: 600;
  background-color: ${props => 
    props.isRecording ? '#6c757d' : 
    props.className?.includes('execute') ? '#28a745' : '#dc3545'};
  color: white;
  transition: background-color 0.2s;

  &:hover {
    opacity: 0.9;
  }
`;

const IssuePanel = styled.div`
  background-color: #f8f9fa;
  padding: 1rem;
  border-radius: 4px;
  margin-bottom: 1rem;
`;

const ThreePanelContainer = styled.div`
  display: flex;
  gap: 1rem;
  height: 70vh;
`;

const FileExplorer = styled.div`
  flex: 0.7;
  background: #1e1e1e;
  border-radius: 4px;
  padding: 1rem;
  color: #fff;
  overflow-y: auto;
  font-family: 'Consolas', 'Monaco', monospace;
`;

const FileItem = styled.div<{ isSelected?: boolean }>`
  padding: 0.5rem;
  cursor: pointer;
  border-radius: 4px;
  margin-bottom: 0.2rem;
  background: ${props => props.isSelected ? '#2d2d2d' : 'transparent'};
  
  &:hover {
    background: #2d2d2d;
  }
`;

function App() {
  const [code, setCode] = useState<string>('');
  const [isRecording, setIsRecording] = useState(false);
  const [currentIssue, setCurrentIssue] = useState<Issue | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContents, setFileContents] = useState<Record<string, string>>({});
  const [output, setOutput] = useState<string>('');
  const [initialFileContents, setInitialFileContents] = useState<Record<string, string>>({});

  // Fetch random issue on component mount
  useEffect(() => {
    fetchRandomIssue();
  }, []);

  const fetchRandomIssue = async () => {
    try {
      const response = await axios.get('http://localhost:3001/api/issues/random');
      setCurrentIssue(response.data);
      
      // Create a map of filename to content
      const contents: Record<string, string> = {};
      response.data.repository.forEach((file: RepoFile) => {
        contents[file.filename] = file.content;
      });
      setFileContents(contents);
      setInitialFileContents(contents);
      
      // Set initial code to the first Python file found, or first file if no Python files
      const pythonFile = response.data.repository.find((f: RepoFile) => f.filename.endsWith('.py'));
      const firstFile = pythonFile || response.data.repository[0];
      if (firstFile) {
        setSelectedFile(firstFile.filename);
        setCode(firstFile.content);
      }
    } catch (error) {
      console.error('Error fetching issue:', error);
    }
  };

  const handleEditorChange = (value: string | undefined) => {
    if (!value || !selectedFile) return;
    setCode(value);
    setFileContents(prev => ({
      ...prev,
      [selectedFile]: value
    }));
  };

  const toggleRecording = async () => {
    if (isRecording) {
      // Stopping recording
      try {
        const response = await axios.post('http://localhost:3001/api/recording/stop');
        console.log('Final report:', response.data);
        // You can do something with the final report here
      } catch (error) {
        console.error('Error stopping recording:', error);
      }
    }
    setIsRecording(!isRecording);
  };

  const executeCode = async () => {
    if (!currentIssue || !selectedFile) return;

    try {
      let response;  // Declare response variable
      
      // If recording, send the trace with the execute request
      if (isRecording) {
        // Convert file contents to array format matching issue.json
        const modifiedFiles = Object.entries(fileContents).map(([filename, content]) => ({
          filename,
          content
        }));

        const initialFiles = Object.entries(initialFileContents).map(([filename, content]) => ({
          filename,
          content
        }));

        const traceData = {
          issue: currentIssue.issue,
          initial_repository: initialFiles,
          modified_repository: modifiedFiles,
          current_file: selectedFile
        };

        response = await axios.post('http://localhost:3001/api/execute', {
          code: code,
          trace: traceData
        });
      } else {
        // Normal execution without recording
        response = await axios.post('http://localhost:3001/api/execute', {
          code: code
        });
      }
      
      setOutput(response.data.message);
      
    } catch (error) {
      console.error('Error:', error);
      setOutput('Error executing code');
    }
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const handleFileSelect = (filename: string) => {
    setSelectedFile(filename);
    // Use the stored file contents when switching files
    setCode(fileContents[filename]);
  };

  const getFileLanguage = (filename: string): string => {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'py': return 'python';
      case 'js': return 'javascript';
      case 'ts': return 'typescript';
      case 'json': return 'json';
      case 'md': return 'markdown';
      case 'sh': return 'shell';
      default: return 'plaintext';
    }
  };

  return (
    <Container>
      <Header>
        <h1>Datacurve Code Recorder</h1>
      </Header>

      {currentIssue && (
        <IssuePanel>
          <h3>Current Issue:</h3>
          <p>{currentIssue.issue}</p>
        </IssuePanel>
      )}

      <ControlPanel>
        <Button
          onClick={toggleRecording}
          isRecording={isRecording}
        >
          {isRecording ? 'Stop Recording' : 'Start Recording'}
        </Button>
        <button 
          style={{ 
            padding: '0.5rem 1rem',
            borderRadius: '4px',
            border: 'none',
            cursor: 'pointer',
            backgroundColor: '#28a745',
            color: 'white',
            fontWeight: '600'
          }} 
          onClick={executeCode}
        >
          Execute Code
        </button>
      </ControlPanel>

      <ThreePanelContainer>
        <FileExplorer>
          <h3 style={{ marginTop: 0 }}>Repository Files</h3>
          {currentIssue?.repository.map((file: RepoFile) => (
            <FileItem
              key={file.filename}
              isSelected={selectedFile === file.filename}
              onClick={() => handleFileSelect(file.filename)}
            >
              {file.filename}
            </FileItem>
          ))}
        </FileExplorer>

        <EditorWrapper>
          <Editor
            height="100%"
            defaultLanguage="python"
            language={selectedFile ? getFileLanguage(selectedFile) : 'python'}
            value={code}
            onChange={handleEditorChange}
            theme="vs-dark"
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              lineNumbers: 'on',
              automaticLayout: true,
            }}
          />
        </EditorWrapper>
        
        <SidePanel>
          <h3 style={{ marginTop: 0 }}>Output</h3>
          <pre>{output}</pre>
        </SidePanel>
      </ThreePanelContainer>
    </Container>
  );
}

export default App;
