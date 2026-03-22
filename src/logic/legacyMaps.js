export const p2SwapMap = {
  "1": { text: "B", hasSwap: true },
  B: { text: "1", hasSwap: true },
  "4": { text: "C", hasSwap: true },
  C: { text: "4", hasSwap: true },
};

export const p2PositionMap = {
  A: "A",
  B: "1",
  C: "4",
  D: "D",
  "1": "B",
  "2": "2",
  "3": "3",
  "4": "C",
};

export const p24ReplicaSwapMap = {
  ac_circle: {
    A: "2",
    B: "D",
    C: "C",
    D: "1",
    "1": "3",
    "2": "A",
    "3": "B",
    "4": "4",
  },
  ac_stack: {
    A: "A",
    B: "1",
    C: "4",
    D: "D",
    "1": "B",
    "2": "2",
    "3": "3",
    "4": "C",
  },
};

export const headmarkerFirstMap = {
  cross: "A-D",
  x: "1-4",
};

export const headmarkerSecondMap = {
  cross: "1-4",
  x: "A-D",
};
