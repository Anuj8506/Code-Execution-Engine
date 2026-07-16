import { useState } from 'react'
import MonacoEditor from '@monaco-editor/react'
import { Link } from 'react-router-dom'
import axios from 'axios'

const DEFAULT_CODE = {
  python: `print("Hello from Docker!")`,
  java: `public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello from Docker!");\n    }\n}`,
  cpp: `#include <iostream>\nusing namespace std;\nint main() {\n    cout << "Hello from Docker!" << endl;\n    return 0;\n}`
}

function Editor() {
  const [language, setLanguage] = useState('python')
  const [code, setCode] = useState(DEFAULT_CODE['python'])
  const [output, setOutput] = useState([])
  const [isRunning, setIsRunning] = useState(false)
  const [status, setStatus] = useState(null)
  const [input, setInput] = useState('')

  const handleSubmit = async () => {
    const submissionId = crypto.randomUUID()
    setOutput([])
    setIsRunning(true)
    setStatus(null)

    const ws = new WebSocket('ws://localhost:8080')

    ws.onopen = () => {
      ws.send(JSON.stringify({ submissionId }))
    }

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data)
      if (message.type === 'output') {
        setOutput((prev) => [...prev, message.data])
      } else if (message.type === 'done') {
        setIsRunning(false)
        setStatus('success')
        ws.close()
      } else if (message.type === 'error') {
        setIsRunning(false)
        setStatus('error')
        ws.close()
      }
    }

    await axios.post('http://localhost:3000/submit', {
      submissionId,
      language,
      code,
      input
    })
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col">

      {/* Header */}
        <header className="bg-gray-800 border-b border-gray-700 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Code Execution Engine</h1>
        <nav className="flex gap-4 text-sm">
            <Link to="/" className="text-white font-semibold">Editor</Link>
            <Link to="/history" className="text-gray-400 hover:text-white">History</Link>
        </nav>
        </header>
      {/* Main Area */}
      <div className="flex overflow-hidden" style={{ height: 'calc(100vh - 57px)' }}>

        {/* Left Panel - Editor */}
        <div className="flex flex-col w-1/2 border-r border-gray-700">
          <div className="bg-gray-800 px-4 py-2 flex items-center justify-between">
            <select
              value={language}
              onChange={(e) => {
                setLanguage(e.target.value)
                setCode(DEFAULT_CODE[e.target.value])
              }}
              className="bg-gray-700 text-gray-100 text-sm px-3 py-1 rounded border border-gray-600 focus:outline-none"
            >
              <option value="python">Python</option>
              <option value="java">Java</option>
              <option value="cpp">C++</option>
            </select>

            <button
              onClick={handleSubmit}
              disabled={isRunning}
              className="bg-green-500 hover:bg-green-400 disabled:bg-gray-600 disabled:cursor-not-allowed text-black font-semibold text-sm px-4 py-1 rounded"
            >
              {isRunning ? 'Running...' : 'Run Code'}
            </button>
          </div>

          <div className="flex-1">
            <MonacoEditor
              height="100%"
              language={language}
              value={code}
              onChange={(value) => setCode(value)}
              theme="vs-dark"
              options={{
                fontSize: 14,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                automaticLayout: true,
              }}
            />
          </div>
        </div>

        {/* Right Panel - Input + Output */}
        <div className="flex flex-col w-1/2">

          {/* Input Panel */}
          <div className="flex flex-col h-1/3 border-b border-gray-700">
            <div className="bg-gray-800 px-4 py-2 text-sm text-gray-400">Input</div>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Provide input for your program here..."
              className="flex-1 bg-gray-950 text-gray-100 font-mono text-sm p-4 resize-none focus:outline-none placeholder-gray-600"
            />
          </div>

          {/* Output Panel */}
          <div className="flex flex-col flex-1">
            <div className="bg-gray-800 px-4 py-2 text-sm text-gray-400 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span>Output</span>
                {status === 'success' && (
                  <span className="text-xs bg-green-500 text-black px-2 py-0.5 rounded font-semibold">Success</span>
                )}
                {status === 'error' && (
                  <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded font-semibold">Error</span>
                )}
              </div>
              {output.length > 0 && (
                <button
                  onClick={() => { setOutput([]); setStatus(null) }}
                  className="text-xs text-gray-500 hover:text-gray-300"
                >
                  Clear
                </button>
              )}
            </div>

            <div className="flex-1 bg-gray-950 p-4 font-mono text-sm overflow-y-auto">
              {isRunning && (
                <div className="flex items-center gap-2 text-gray-500 mb-2">
                  <span className="animate-pulse">▋</span>
                  <span>Running...</span>
                </div>
              )}
              {output.length === 0 && !isRunning ? (
                <p className="text-gray-600">Output will appear here...</p>
              ) : (
                output.map((line, index) => (
                  <div
                    key={index}
                    className={`whitespace-pre-wrap ${status === 'error' ? 'text-red-400' : 'text-green-400'}`}
                  >
                    {line}
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}

export default Editor;