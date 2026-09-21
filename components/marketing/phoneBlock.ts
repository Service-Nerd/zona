/**
 * What a marketing device still needs to know about the runner's block.
 *
 * ⚠️ ITS OWN FILE ON PURPOSE. `PhoneFrame.tsx` holds `TodayStill`, which the
 * CLIENT component `TabbedPhone` imports, and a client import pulls the whole
 * module graph. Declaring this type next to the producer (`demoPlanScreen`,
 * which calls the rule engine) or next to the consumer (`PhoneFrame`) both
 * create an edge that drags the engine into the browser. A leaf type module
 * has no graph to drag.
 */
export type DemoBlockView = { weekN: number; totalWeeks: number }
