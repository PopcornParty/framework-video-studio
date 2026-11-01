export default function SettingsPage() {
  return (
    <div className="p-4 space-y-6">
      <h2 className="text-2xl font-semibold">Settings</h2>
      <div className="space-y-4">
        <div className="bg-dark-card border border-dark-border rounded-lg p-4">
          <h3 className="font-medium mb-2">Rendering</h3>
          <p className="text-sm text-gray-400">Not available yet. No render settings can be changed.</p>
        </div>
        <div className="bg-dark-card border border-dark-border rounded-lg p-4">
          <h3 className="font-medium mb-2">Storage</h3>
          <p className="text-sm text-gray-400">Productions and media are stored in IndexedDB on this device. Use Projects to export metadata.</p>
        </div>
        <div className="bg-dark-card border border-dark-border rounded-lg p-4">
          <h3 className="font-medium mb-2">About</h3>
          <p className="text-sm text-gray-400">FRAMEWORK Video Studio. Stages 1–2 only. No external AI APIs.</p>
        </div>
      </div>
    </div>
  )
}
