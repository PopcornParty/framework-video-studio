export default function Dashboard() {
  return (
    <div className="p-4 space-y-6">
      <h2 className="text-2xl font-semibold">Dashboard</h2>
      <div className="grid gap-4">
        <div className="bg-dark-card border border-dark-border rounded-lg p-4">
          <h3 className="font-medium mb-2">Recent Productions</h3>
          <p className="text-sm text-gray-400">No productions yet. Create your first video.</p>
        </div>
        <div className="bg-dark-card border border-dark-border rounded-lg p-4">
          <h3 className="font-medium mb-2">Media Library</h3>
          <p className="text-sm text-gray-400">0 assets</p>
        </div>
        <div className="bg-dark-card border border-dark-border rounded-lg p-4">
          <h3 className="font-medium mb-2">Storage</h3>
          <p className="text-sm text-gray-400">IndexedDB local storage</p>
        </div>
      </div>
    </div>
  )
}
