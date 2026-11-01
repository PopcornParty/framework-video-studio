export default function CreateVideo() {
  return (
    <div className="p-4 space-y-6">
      <h2 className="text-2xl font-semibold">Create Video</h2>
      <textarea
        className="w-full h-40 bg-dark-card border border-dark-border rounded-lg p-3 text-sm resize-none focus:outline-none focus:border-blue-500"
        placeholder="Describe the video you want to create..."
      />
      <div className="flex gap-4">
        <select className="bg-dark-card border border-dark-border rounded-lg px-3 py-2 text-sm">
          <option>30 seconds</option>
          <option>15 seconds</option>
          <option>60 seconds</option>
        </select>
        <select className="bg-dark-card border border-dark-border rounded-lg px-3 py-2 text-sm">
          <option>YouTube Shorts</option>
          <option>TikTok</option>
          <option>Instagram Reels</option>
        </select>
      </div>
      <button className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-medium">
        Generate Storyboard
      </button>
    </div>
  )
}
