export function assessmentToRows(value, field = "", itemIndex = 0, rows = []) {
  if (value === null || value === undefined) return rows;
  if (Array.isArray(value)) {
    value.forEach((item, index) => assessmentToRows(item, typeof item === "object" && item !== null ? field : `${field}.__item`, index, rows));
    return rows;
  }
  if (typeof value === "object") {
    Object.entries(value).forEach(([key, item]) => assessmentToRows(item, field ? `${field}.${key}` : key, itemIndex, rows));
    return rows;
  }
  rows.push({ field, item_index: itemIndex, value: String(value) });
  return rows;
}

function parseValue(value) {
  if (value === "true") return true;
  if (value === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  return value;
}

export function rowsToAssessment(rows = []) {
  const result = {};
  for (const row of rows) {
    const [root, ...rest] = String(row.field || "").split(".");
    if (!root) continue;
    if (rest[0] === "__item") {
      const list = (result[root] ||= []);
      list[row.item_index] = parseValue(row.value || "");
      continue;
    }
    const target = rest.length ? (result[root] ||= []) : result;
    if (!rest.length) {
      result[root] = parseValue(row.value || "");
      continue;
    }
    const item = (target[row.item_index] ||= {});
    let cursor = item;
    rest.forEach((part, index) => {
      if (index === rest.length - 1) cursor[part] = parseValue(row.value || "");
      else cursor = cursor[part] ||= {};
    });
  }
  return result;
}
