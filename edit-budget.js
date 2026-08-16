(() => {
  const tables = [...document.querySelectorAll('.budget-table')];
  if (!tables.length) return;

  const storageKey = `the-budget:${location.pathname}:v1`;
  const money = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const parseMoney = (text) => {
    const cleaned = String(text).replace(/[^0-9.-]/g, '');
    const value = Number(cleaned);
    return Number.isFinite(value) ? value : 0;
  };

  const format = (value) => money.format(value).replace('-$', '-$');

  const setValueCells = (row, annual) => {
    const cells = row.cells;
    if (cells.length < 5) return;
    cells[1].textContent = format(annual);
    cells[2].textContent = format(annual / 12);
    cells[3].textContent = format(annual / 26);
    cells[4].textContent = format(annual / 52);
    for (let i = 1; i < 5; i++) {
      cells[i].classList.toggle('negative', parseMoney(cells[i].textContent) < 0);
    }
  };

  const getEditableRows = (table) => [...table.tBodies[0].rows].filter(row => !row.classList.contains('total-row'));

  const save = () => {
    const state = tables.map(table => getEditableRows(table).map(row => ({
      name: row.cells[0].textContent.trim(),
      annual: parseMoney(row.cells[1].textContent)
    })));
    localStorage.setItem(storageKey, JSON.stringify(state));
  };

  const load = () => {
    try {
      const state = JSON.parse(localStorage.getItem(storageKey) || 'null');
      if (!Array.isArray(state)) return;
      tables.forEach((table, ti) => {
        const rows = getEditableRows(table);
        if (!Array.isArray(state[ti])) return;
        rows.forEach((row, ri) => {
          const saved = state[ti][ri];
          if (!saved) return;
          row.cells[0].textContent = saved.name;
          setValueCells(row, Number(saved.annual) || 0);
        });
      });
    } catch (_) {}
  };

  const sumAnnual = (table) => getEditableRows(table).reduce((sum, row) => sum + parseMoney(row.cells[1].textContent), 0);

  const findRow = (table, label) => [...table.tBodies[0].rows].find(row => row.cells[0]?.textContent.trim() === label);

  const refreshCalculated = () => {
    const incomeTable = tables[0];
    const spendingTable = tables[1];
    if (!incomeTable || !spendingTable) return;

    const netIncome = sumAnnual(incomeTable);
    const totalOutgoing = sumAnnual(spendingTable);
    const savings = netIncome - totalOutgoing;

    const netRow = findRow(incomeTable, 'Net Income');
    const outgoingRow = findRow(spendingTable, 'Total Outgoing');
    const savingsRow = findRow(spendingTable, 'Savings');
    if (netRow) setValueCells(netRow, netIncome);
    if (outgoingRow) setValueCells(outgoingRow, totalOutgoing);
    if (savingsRow) setValueCells(savingsRow, savings);

    const allocationTable = tables[2];
    if (allocationTable) {
      const allocationSavings = findRow(allocationTable, 'Savings');
      if (allocationSavings) setValueCells(allocationSavings, savings);
    }

    const heroValues = [...document.querySelectorAll('.hero .kpi .value')];
    const periodValues = [savings, savings / 12, savings / 26, savings / 52];
    heroValues.slice(0, 4).forEach((el, i) => {
      el.textContent = format(periodValues[i]);
      el.classList.toggle('negative', periodValues[i] < 0);
      el.classList.toggle('positive', periodValues[i] >= 0);
    });
  };

  const makeEditable = () => {
    tables.forEach((table, ti) => {
      getEditableRows(table).forEach((row) => {
        const nameCell = row.cells[0];
        const annualCell = row.cells[1];

        // Savings in the account-allocation table is calculated from the main budget.
        const calculatedAllocationSavings = ti === 2 && nameCell.textContent.trim() === 'Savings';
        if (calculatedAllocationSavings) {
          row.classList.add('calculated-row');
          return;
        }

        nameCell.contentEditable = 'true';
        annualCell.contentEditable = 'true';
        nameCell.classList.add('editable-cell');
        annualCell.classList.add('editable-cell', 'editable-money');
        nameCell.title = 'Click to edit item name';
        annualCell.title = 'Click to edit annual amount';

        nameCell.addEventListener('input', save);
        annualCell.addEventListener('focus', () => {
          annualCell.textContent = String(parseMoney(annualCell.textContent));
          const range = document.createRange();
          range.selectNodeContents(annualCell);
          const selection = window.getSelection();
          selection.removeAllRanges();
          selection.addRange(range);
        });
        annualCell.addEventListener('input', () => {
          const annual = parseMoney(annualCell.textContent);
          row.cells[2].textContent = format(annual / 12);
          row.cells[3].textContent = format(annual / 26);
          row.cells[4].textContent = format(annual / 52);
          refreshCalculated();
          save();
        });
        annualCell.addEventListener('blur', () => {
          setValueCells(row, parseMoney(annualCell.textContent));
          refreshCalculated();
          save();
        });
        annualCell.addEventListener('keydown', (event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            annualCell.blur();
          }
        });
      });
    });
  };

  const controls = document.createElement('div');
  controls.className = 'edit-notice';
  controls.innerHTML = '<div><strong>Editable budget</strong><span>Click any item name or Annual amount. Monthly, fortnightly and weekly recalculate automatically. Changes save on this device.</span></div><button type="button" class="reset-budget">Reset edits</button>';
  const firstCard = document.querySelector('.budget-card');
  if (firstCard) firstCard.before(controls);
  controls.querySelector('.reset-budget').addEventListener('click', () => {
    localStorage.removeItem(storageKey);
    location.reload();
  });

  load();
  makeEditable();
  refreshCalculated();
})();