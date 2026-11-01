import { useParams } from 'react-router-dom'

export default function StoryboardEditor() {
  const { id } = useParams()
  return (
    <div className="p-4">
      <h2 className="text-2xl font-semibold mb-4">Storyboard {id ? `#${id}` : 'New'}</h2>
      <p className="text-gray-400">Storyboard editor will appear here.</p>
    </div>
  )
}
