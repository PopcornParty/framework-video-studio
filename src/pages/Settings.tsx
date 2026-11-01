export default function SettingsPage() {
  return (
    <div className="p-4 space-y-6">
      <h2 className="text-2xl font-semibold">Settings</h2>
      <div className="space-y-4">
        <div className="bg-dark-card border border-dark-border rounded-lg p-4">
          <h3 className="font-medium mb-2">Rendering</h3>
          <p className="text-sm text-gray-400">Default resolution and format settings</p>
        </div>
        <div className="bg-dark-card border border-dark-border rounded-lg p-4">
          <h3 className="font-medium mb-2">Storage</h3>
          <p className="text-sm text-gray-400">Manage local IndexedDB data</p>
        </div>
      </div>
    </div>
  )
}
