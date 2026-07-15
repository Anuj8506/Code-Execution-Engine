import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'

function History() {
    const [submissions, setSubmissions] = useState([])
    const [loading, setLoading] = useState(true)
    const [selectedSubmission, setSelectedSubmission] = useState(null)

    useEffect(() => {
        axios.get('http://localhost:3000/submissions')
            .then((res) => {
            setSubmissions(res.data)
            setLoading(false)
            })
        }, [])

    return (
        <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col">

        {/* Header */}
        <header className="bg-gray-800 border-b border-gray-700 px-6 py-4 flex items-center justify-between">
            <h1 className="text-xl font-bold text-white">Code Execution Engine</h1>
            <nav className="flex gap-4 text-sm">
            <Link to="/" className="text-gray-400 hover:text-white">Editor</Link>
            <Link to="/history" className="text-white font-semibold">History</Link>
            </nav>
        </header>

        {/* Content */}
        <div className="p-6">
            {loading ? (
            <p className="text-gray-400">Loading submissions...</p>
            ) : (
            <table className="w-full text-sm">
                <thead>
                <tr className="text-left text-gray-400 border-b border-gray-700">
                    <th className="pb-3 pr-4">#</th>
                    <th className="pb-3 pr-4">Language</th>
                    <th className="pb-3 pr-4">Status</th>
                    <th className="pb-3 pr-4">Time</th>
                    <th className="pb-3">Output</th>
                </tr>
                </thead>
                <tbody>
                {submissions.map((row, index) => (
                    <tr key={row.submission_id} onClick={() => setSelectedSubmission(row)} className="border-b border-gray-800 hover:bg-gray-800 cursor-pointer">
                    <td className="py-3 pr-4 text-gray-500">{index + 1}</td>
                    <td className="py-3 pr-4">{row.language === 'cpp' ? 'C++' : row.language === 'java' ? 'Java' : 'Python'}</td>
                    <td className="py-3 pr-4">
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${row.status === 'success' ? 'bg-green-500 text-black' : 'bg-red-500 text-white'}`}>
                        {row.status}
                        </span>
                    </td>
                    <td className="py-3 pr-4 text-gray-400">
                        {new Date(row.created_at).toLocaleString()}
                    </td>
                    <td className="py-3 text-gray-300 font-mono">
                        {row.output?.split('\n')[0] || '—'}
                    </td>
                    </tr>
                ))}
                </tbody>
            </table>
            )}
        </div>
        {selectedSubmission && (
        <div
            className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50"
            onClick={() => setSelectedSubmission(null)}
        >
            <div
            className="bg-gray-800 rounded-lg w-3/4 max-h-[80vh] overflow-y-auto p-6"
            onClick={(e) => e.stopPropagation()}
            >
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold">Submission Detail</h2>
                <button onClick={() => setSelectedSubmission(null)} className="text-gray-400 hover:text-white">✕</button>
            </div>

            <div className="mb-4">
                <p className="text-gray-400 text-sm mb-1">Language</p>
                <p>{selectedSubmission.language === 'cpp' ? 'C++' : selectedSubmission.language === 'java' ? 'Java' : 'Python'}</p>
            </div>

            <div className="mb-4">
                <p className="text-gray-400 text-sm mb-1">Status</p>
                <span className={`px-2 py-0.5 rounded text-xs font-semibold ${selectedSubmission.status === 'success' ? 'bg-green-500 text-black' : 'bg-red-500 text-white'}`}>
                {selectedSubmission.status}
                </span>
            </div>

            <div className="mb-4">
                <p className="text-gray-400 text-sm mb-2">Code</p>
                <pre className="bg-gray-900 p-4 rounded text-sm font-mono text-gray-100 overflow-x-auto whitespace-pre-wrap">{selectedSubmission.code}</pre>
            </div>

            <div>
                <p className="text-gray-400 text-sm mb-2">Output</p>
                <pre className="bg-gray-900 p-4 rounded text-sm font-mono text-green-400 overflow-x-auto whitespace-pre-wrap">{selectedSubmission.output}</pre>
            </div>
            </div>
        </div>
        )}

        </div>
    )
}

export default History