/** Versioned storytelling knowledge. Pure data. Do not scatter rules in UI. */

export const STORYTELLING_VERSION = 1

export interface Stage {
  id: string
  name: string
  purpose: string
  achieves: string
  requires: string
}

export interface StoryStructure {
  id: string
  name: string
  purpose: string
  bestFor: string[]
  stages: Stage[]
  requires: string[]
  failsWhen: string[]
  minVerifiedFacts: number
  typicalDurationSec: [number, number]
}

export interface HookPattern {
  id: string
  name: string
  description: string
  bestWith: string[]
  requiresVerifiedFact: boolean
}

export const STRUCTURES: StoryStructure[] = [
  {
    id: 'explanatory',
    name: 'Explanatory',
    purpose: 'Help the viewer understand a subject clearly.',
    bestFor: ['explain', 'how', 'why', 'what is', 'science', 'fact'],
    stages: [
      { id: 'hook', name: 'Hook', purpose: 'Create interest', achieves: 'Viewer wants the answer', requires: 'A clear question or surprising verified fact' },
      { id: 'question', name: 'Question', purpose: 'State what will be explained', achieves: 'Viewer knows the goal', requires: 'Subject from prompt' },
      { id: 'evidence', name: 'Evidence', purpose: 'Present verified facts', achieves: 'Claims are grounded', requires: 'At least one verified or attributed fact' },
      { id: 'explanation', name: 'Explanation', purpose: 'Connect the facts', achieves: 'Viewer understands the mechanism', requires: 'Logical order of facts' },
      { id: 'implication', name: 'Implication', purpose: 'Show why it matters', achieves: 'Viewer sees relevance', requires: 'A consequence or use' },
      { id: 'close', name: 'Close', purpose: 'End cleanly', achieves: 'Viewer retains the core idea', requires: 'Restatement of the main point' },
    ],
    requires: ['At least one approved fact that is verified or user-stated'],
    failsWhen: ['No verified or user-stated facts', 'Only assumptions', 'Subject is purely visual with no claims'],
    minVerifiedFacts: 1,
    typicalDurationSec: [20, 60],
  },
  {
    id: 'montage',
    name: 'Cinematic montage',
    purpose: 'Create mood and progression through imagery and pacing.',
    bestFor: ['cinematic', 'montage', 'supercars', 'night', 'driving', 'visual', 'atmosphere'],
    stages: [
      { id: 'hook', name: 'Hook', purpose: 'Strong opening image or promise', achieves: 'Immediate visual interest', requires: 'A clear visual subject' },
      { id: 'atmosphere', name: 'Atmosphere', purpose: 'Establish place and mood', achieves: 'Viewer feels the setting', requires: 'Environment cues in prompt or assets' },
      { id: 'sequence', name: 'Sequence', purpose: 'Show a progression of moments', achieves: 'Sense of movement', requires: 'Multiple distinct moments' },
      { id: 'peak', name: 'Peak', purpose: 'Strongest image or action', achieves: 'Emotional high point', requires: 'One standout moment' },
      { id: 'resolve', name: 'Resolve', purpose: 'Calm or conclusive image', achieves: 'Satisfying end', requires: 'A closing visual idea' },
    ],
    requires: ['Visual subject in the prompt'],
    failsWhen: ['Prompt is purely explanatory with no visual subject', 'Requested duration far exceeds available distinct moments'],
    minVerifiedFacts: 0,
    typicalDurationSec: [15, 45],
  },
  {
    id: 'comparison',
    name: 'Comparison',
    purpose: 'Show differences or similarities between two things.',
    bestFor: ['compare', 'vs', 'versus', 'difference', 'better', 'or'],
    stages: [
      { id: 'hook', name: 'Hook', purpose: 'Frame the choice or contrast', achieves: 'Viewer cares about the difference', requires: 'Two subjects' },
      { id: 'side-a', name: 'Side A', purpose: 'Present the first subject', achieves: 'Clear picture of A', requires: 'Facts or description of A' },
      { id: 'side-b', name: 'Side B', purpose: 'Present the second subject', achieves: 'Clear picture of B', requires: 'Facts or description of B' },
      { id: 'contrast', name: 'Contrast', purpose: 'Highlight the key difference', achieves: 'Viewer sees the distinction', requires: 'Comparable points' },
      { id: 'judgement', name: 'Judgement', purpose: 'Optional conclusion', achieves: 'Viewer knows the takeaway', requires: 'A stated criterion' },
    ],
    requires: ['Two subjects identifiable in the prompt'],
    failsWhen: ['Only one subject', 'No basis for comparison'],
    minVerifiedFacts: 0,
    typicalDurationSec: [25, 60],
  },
  {
    id: 'reveal',
    name: 'Reveal',
    purpose: 'Build curiosity then deliver a payoff.',
    bestFor: ['reveal', 'secret', 'surprising', 'you won\'t believe', 'hidden'],
    stages: [
      { id: 'hook', name: 'Hook', purpose: 'Promise a payoff', achieves: 'Curiosity', requires: 'A teaser that does not spoil' },
      { id: 'setup', name: 'Setup', purpose: 'Establish context', achieves: 'Viewer understands the stakes', requires: 'Background' },
      { id: 'delay', name: 'Delay', purpose: 'Withhold the answer', achieves: 'Tension', requires: 'Controlled pacing' },
      { id: 'reveal', name: 'Reveal', purpose: 'Deliver the payoff', achieves: 'Satisfaction or surprise', requires: 'The actual information' },
      { id: 'consequence', name: 'Consequence', purpose: 'Show what it means', achieves: 'The reveal lands', requires: 'An implication' },
    ],
    requires: ['A clear payoff that can be withheld'],
    failsWhen: ['Nothing to reveal', 'Payoff is given in the first sentence'],
    minVerifiedFacts: 1,
    typicalDurationSec: [20, 50],
  },
  {
    id: 'list',
    name: 'List / tips',
    purpose: 'Deliver discrete, useful points.',
    bestFor: ['tips', 'ways', 'list', 'top', 'how to', 'steps'],
    stages: [
      { id: 'hook', name: 'Hook', purpose: 'Promise value', achieves: 'Viewer expects useful points', requires: 'A clear benefit' },
      { id: 'points', name: 'Points', purpose: 'Deliver numbered items', achieves: 'Each point is distinct', requires: 'At least three separable ideas' },
      { id: 'summary', name: 'Summary', purpose: 'Reinforce the set', achieves: 'Viewer remembers the list', requires: 'Brief recap' },
    ],
    requires: ['Multiple distinct points'],
    failsWhen: ['Fewer than three separable ideas', 'Points are repetitive'],
    minVerifiedFacts: 0,
    typicalDurationSec: [20, 60],
  },
  {
    id: 'documentary',
    name: 'Documentary-style',
    purpose: 'Observe and contextualise a subject with restraint.',
    bestFor: ['documentary', 'history', 'profile', 'behind', 'story of'],
    stages: [
      { id: 'hook', name: 'Hook', purpose: 'Situate the subject', achieves: 'Viewer knows what they are watching', requires: 'Subject and context' },
      { id: 'context', name: 'Context', purpose: 'Provide background', achieves: 'Viewer understands the setting', requires: 'Background facts or description' },
      { id: 'development', name: 'Development', purpose: 'Show change or detail over time', achieves: 'Depth', requires: 'Sequence of observations' },
      { id: 'reflection', name: 'Reflection', purpose: 'Note significance', achieves: 'Meaning without overclaiming', requires: 'A grounded observation' },
      { id: 'close', name: 'Close', purpose: 'Leave a lasting image or idea', achieves: 'Closure', requires: 'A final grounded note' },
    ],
    requires: ['A subject that can be observed or contextualised'],
    failsWhen: ['No subject', 'Only promotional claims with no observation'],
    minVerifiedFacts: 0,
    typicalDurationSec: [30, 90],
  },
  {
    id: 'qa',
    name: 'Question and answer',
    purpose: 'Answer a specific question directly.',
    bestFor: ['question', '?', 'is it', 'can you', 'does', 'what happens'],
    stages: [
      { id: 'hook', name: 'Hook', purpose: 'Pose or sharpen the question', achieves: 'Viewer wants the answer', requires: 'A clear question' },
      { id: 'answer', name: 'Answer', purpose: 'Give the direct response', achieves: 'Viewer has the answer', requires: 'A usable fact or clear statement' },
      { id: 'support', name: 'Support', purpose: 'Briefly ground the answer', achieves: 'Answer feels earned', requires: 'One supporting point' },
      { id: 'close', name: 'Close', purpose: 'Restate the answer', achieves: 'Retention', requires: 'Short restatement' },
    ],
    requires: ['A question in the prompt or research'],
    failsWhen: ['No clear question', 'No usable answer in approved facts'],
    minVerifiedFacts: 1,
    typicalDurationSec: [15, 40],
  },
]

export const HOOKS: HookPattern[] = [
  { id: 'question', name: 'Question', description: 'Open with a direct question the video will answer.', bestWith: ['explanatory', 'qa', 'reveal'], requiresVerifiedFact: false },
  { id: 'surprising-fact', name: 'Surprising verified fact', description: 'Open with a verified fact that is unexpected.', bestWith: ['explanatory', 'reveal', 'documentary'], requiresVerifiedFact: true },
  { id: 'curiosity-gap', name: 'Curiosity gap', description: 'Hint at information without revealing it.', bestWith: ['reveal', 'explanatory'], requiresVerifiedFact: false },
  { id: 'visual-promise', name: 'Visual promise', description: 'Promise a striking image or sequence.', bestWith: ['montage', 'documentary'], requiresVerifiedFact: false },
  { id: 'unexpected-comparison', name: 'Unexpected comparison', description: 'Open by contrasting two things the viewer may not have linked.', bestWith: ['comparison'], requiresVerifiedFact: false },
  { id: 'direct-address', name: 'Direct audience engagement', description: 'Speak to the viewer about something relevant to them.', bestWith: ['list', 'qa', 'explanatory'], requiresVerifiedFact: false },
]

export const PACING_NOTES = {
  short: 'Under 20s: one idea, fast cuts, single hook, immediate close.',
  medium: '20–45s: hook, development, peak or explanation, close.',
  long: '45s+: allow a delay or extra stage, but keep each stage purposeful.',
}
