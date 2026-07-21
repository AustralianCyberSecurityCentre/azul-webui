/** Different themes available for user selection. */
export const enum ColorTheme {
  Light = "light",
  Dark = "dark",
}

export enum RelationalGraphLevel {
  NO = "no cousins",
  YES_SMALL = "show fewest cousins",
  YES = "show cousins",
  YES_LARGE = "show max cousins",
}

export enum SourceViewEnum {
  References = "References",
  GroupedReferences = "Grouped References",
  Submission = "Submission",
}

// Valid options for hex view groupings
// Note this directly maps to what class is used for rendering (on the hex view tab) so adding more requires more classes be created.
export enum ValidHexSpaces {
  opt1 = "1",
  opt2 = "2",
  opt4 = "4",
  opt16 = "16",
}
