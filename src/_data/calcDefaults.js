// The calculator's fallback figures, used only when a figure in the editor's
// "Cost calculator" entry is left blank. The editor's figures are the ones the
// page uses; these come from src/js/cost-calculator.js so they're written once.
const { PER_EMPLOYEE, ASSUMPTIONS } = require("../js/cost-calculator.js");

module.exports = { perEmployee: PER_EMPLOYEE, assumptions: ASSUMPTIONS };
