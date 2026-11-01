export default function MediaLibrary() {
  return (
    <div className="p-4 space-y-4">
      <h2 className="text-2xl font-semibold">Media Library</h2>
      <input
        type="search"
        placeholder="Search assets..."
        className="w-full bg-dark-card border border-dark-border rounded-lg px-3 py-2 text-sm"
      />
      <div className="text-center py-12 text-gray-400">
        <p>No assets yet</p>
        <p className="text-sm mt-2">Upload video or image files you have rights to use</p>
      </div>
    </div>
  )
}
