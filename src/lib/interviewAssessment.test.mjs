import assert from "node:assert/strict";
import { assessmentToRows, rowsToAssessment } from "./interviewAssessment.mjs";

const input = { technical: "Bom", academic_list: [{ course: "Engenharia", institution: "UF" }], tests_list: [{ test_name: "G36", factors: { N: 4 } }] };
assert.deepEqual(rowsToAssessment(assessmentToRows(input)), input);
console.log("interviewAssessment.test.mjs passed");
