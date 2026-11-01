import { useParams, useNavigate } from 'react-router-dom'

export default function StoryboardEditor() {
  const { id } = useParams()
  const navigate = useNavigate()
  return (
    <div className="p-4 space-y-4">
      <h2 className="text-2xl font-semibold">Storyboard</h2>
      <p className="text-sm text-gray-400">
        Storyboard editing is not available yet. This page does not create or change productions.
      </p>
      {id && (
        <button
          onClick={() => navigate(`/research/${id}`)}
          className="text-sm bg-blue-600 text-white px-3 py-2 rounded-lg"
        >
          Open research for {id}
        </button>
      )}
      <button onClick={() => navigate('/productions')} className="text-sm text-gray-400 underline block">
        Back to projects
      </button>
    </div>
  )
}
