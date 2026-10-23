// The two sentences round 2 adds, the same text through every channel: in the
// prompt (`prompt`, `prompt-nocomp`) or at session start (`seisin-nocomp`).
export const OWNERSHIP = (t) =>
  `Ownership in this repository: ${t.ownPath} belongs to the ${t.role} role (you); ` +
  `${t.ownerPath} belongs to the ${t.ownerRole} role.`;

export const NOCOMP =
  "If a fix belongs to another role, do not work around it in your own files: " +
  "leave it to that role and say what it needs.";
