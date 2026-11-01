export interface StorytellingState {
  version: number
  recommendedStructureId: string
  selectedStructureId: string
  userOverride: boolean
  recommendedHookId: string
  selectedHookId: string
  reason: string
  issues: string[]
  lastUpdated: number
}
