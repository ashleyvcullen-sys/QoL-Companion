const DOG_AGE_HUMAN_YEARS = {
  "0-20": { 1: 15, 2: 24, 3: 28, 4: 32, 5: 36, 6: 40, 7: 44, 8: 48, 9: 52, 10: 56, 11: 60, 12: 64, 13: 68, 14: 72, 15: 76, 16: 80, 17: 84, 18: 88, 19: 92, 20: 96 },
  "21-50": { 1: 15, 2: 24, 3: 28, 4: 33, 5: 37, 6: 42, 7: 47, 8: 51, 9: 56, 10: 60, 11: 65, 12: 69, 13: 74, 14: 78, 15: 83, 16: 87, 17: 92, 18: 96, 19: 101, 20: 105 },
  "51-90": { 1: 15, 2: 24, 3: 30, 4: 35, 5: 40, 6: 45, 7: 50, 8: 55, 9: 61, 10: 66, 11: 72, 12: 77, 13: 82, 14: 88, 15: 93, 16: 99, 17: 104, 18: 109, 19: 115, 20: 120 },
  "90+": { 1: 15, 2: 24, 3: 32, 4: 37, 5: 42, 6: 49, 7: 56, 8: 64, 9: 71, 10: 78, 11: 86, 12: 93, 13: 101, 14: 108, 15: 115, 16: 123 },
};
const CAT_AGE_HUMAN_YEARS = { 1: 15, 2: 24, 3: 28, 4: 32, 5: 36, 6: 40, 7: 44, 8: 48, 9: 52, 10: 56, 11: 60, 12: 64, 13: 68, 14: 72, 15: 76, 16: 80, 17: 84, 18: 88, 19: 92, 20: 96 };

function humanYearsChartFor(species, weightRangeKey) {
  if (species === "cat") return CAT_AGE_HUMAN_YEARS;
  return DOG_AGE_HUMAN_YEARS[weightRangeKey] || DOG_AGE_HUMAN_YEARS["21-50"];
}

export function humanYearsForAge(species, weightRangeKey, ageLabel) {
  const match = /^(\d+) years?$/.exec(ageLabel || "");
  if (!match) return null;
  const y = parseInt(match[1], 10);
  const chart = humanYearsChartFor(species, weightRangeKey);
  return chart[y] || null;
}
